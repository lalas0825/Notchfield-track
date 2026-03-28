# FIX TRACK — 11 Audit FAILs + Auto-Blindaje
# Pega este prompt en Claude Code en el repo de TRACK.
# Reference: AUDIT_TRACK.md checks #5, #12, #17, #20, #24, #27, #46, #48, #50, #54, #61

---

Lee AUDIT_TRACK.md y CLAUDE_TRACK.md primero. Luego ejecuta estos 11 fixes en orden.
Después de cada fix, verifica que no rompe nada existente.
Al final, genera AUDIT_TRACK_FIXES.md con evidencia de cada fix.

---

## FIX 1 (CRITICAL): Writes bypass PowerSync — migrar a local-first writes
> Audit checks: #24, #45
> Todas las escrituras van directo a `supabase.from()`. Esto rompe offline-first.
> PowerSync requiere escribir a SQLite local primero, luego sync.

**Archivos a modificar:**
- `src/features/production/store/production-store.ts`
- `src/features/crew/store/crew-store.ts`
- `src/features/gps/services/gps-service.ts`
- `src/features/photos/services/photo-queue.ts`
- `src/features/production/services/report-service.ts`
- `src/features/punch/services/punch-service.ts`
- `src/features/safety/hooks/useSafetyDocs.ts`
- `src/features/tickets/hooks/useTickets.ts`

**Patrón a aplicar:**
Reemplazar `supabase.from(table).insert(data)` con `powerSync.execute()`:

```typescript
// ANTES (no funciona offline):
await supabase.from('crew_assignments').insert({ worker_id, area_id, ... });

// DESPUÉS (offline-first):
import { usePowerSync } from '@powersync/react-native';
// o importar el singleton desde shared/lib/powersync/client.ts

await powerSync.execute(
  `INSERT INTO crew_assignments (id, organization_id, project_id, worker_id, area_id, assigned_by, created_at)
   VALUES (uuid(), ?, ?, ?, ?, ?, datetime('now'))`,
  [orgId, projectId, workerId, areaId, assignedBy]
);
```

**Para updates:**
```typescript
// ANTES:
await supabase.from('production_areas').update({ status: 'complete' }).eq('id', areaId);

// DESPUÉS:
await powerSync.execute(
  `UPDATE production_areas SET status = ?, completed_at = datetime('now'), completed_by = ? WHERE id = ?`,
  ['complete', userId, areaId]
);
```

**Para deletes:**
```typescript
// ANTES:
await supabase.from('crew_assignments').delete().eq('worker_id', workerId);

// DESPUÉS:
await powerSync.execute(
  `DELETE FROM crew_assignments WHERE worker_id = ?`,
  [workerId]
);
```

**IMPORTANTE:** 
- Usar `uuid()` de PowerSync para generar IDs (o `crypto.randomUUID()`)
- PowerSync's `uploadData` en `supabase-connector.ts` ya maneja el sync a Supabase
- Verificar que `supabase-connector.ts` `uploadData()` mapea correctamente INSERT/UPDATE/DELETE
- El photo-queue puede mantener supabase direct para Storage uploads (binary files), pero los metadata inserts a `field_photos` deben ir via PowerSync
- report-service.ts usa upsert — PowerSync no tiene upsert nativo, usar INSERT OR REPLACE o check-then-insert

**Verificación:** Poner el dispositivo en airplane mode → crear un work ticket → marcar una superficie complete → asignar un crew → verificar que todo se guarda localmente → reconectar → verificar sync.

---

## FIX 2 (HIGH): No production_block_logs writes
> Audit checks: #12, #32, #61
> Cuando el foreman bloquea un área, Track solo actualiza production_areas.
> No inserta en production_block_logs — Takeoff Block Analysis queda sin data.

**Archivo:** `src/features/production/store/production-store.ts`

**En la función `markAreaStatus()`**, después de actualizar production_areas con status='blocked', agregar:

```typescript
if (status === 'blocked' && blockedReason) {
  await powerSync.execute(
    `INSERT INTO production_block_logs (
      id, organization_id, project_id, area_id, 
      blocked_reason, blocked_at, reported_by, created_at
    ) VALUES (uuid(), ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
    [orgId, projectId, areaId, blockedReason, userId]
  );
}
```

**También en unblock**, registrar la resolución:
```typescript
if (status === 'in_progress' && area.blocked_reason) {
  // Find the open block log and close it
  await powerSync.execute(
    `UPDATE production_block_logs 
     SET resolved_at = datetime('now'), resolved_by = ?
     WHERE area_id = ? AND resolved_at IS NULL`,
    [userId, areaId]
  );
}
```

**Verificar:** Que production_block_logs está en el PowerSync schema (`schema.ts`) y sync rules.
Si no está, agregar:
- schema.ts: nueva tabla definition
- sync-rules.yaml: `SELECT * FROM production_block_logs WHERE organization_id = bucket.organization_id`

---

## FIX 3 (HIGH): No error boundaries
> Audit check: #27
> Un error en cualquier componente crashea toda la app — pantalla blanca.

**Crear:** `src/shared/components/ErrorBoundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', padding: 24 }}>
          <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity 
            onPress={this.handleReset}
            style={{ backgroundColor: '#F97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
```

**Aplicar en:** `src/app/_layout.tsx` — wrappear el contenido principal:
```typescript
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

// En el return del layout:
<ErrorBoundary>
  <Slot />
</ErrorBoundary>
```

**También wrappear cada tab layout** en `src/app/(tabs)/_layout.tsx` para que un error en un tab no crashee los otros.

---

## FIX 4 (MEDIUM): No haptic feedback
> Audit check: #50
> El foreman necesita SENTIR que el tap registró. Especialmente con guantes.

**Instalar:** `npx expo install expo-haptics`

**Crear:** `src/shared/lib/haptics.ts`
```typescript
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptic = {
  light: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => Platform.OS !== 'web' && Haptics.selectionAsync(),
};
```

**Aplicar en:**
- `production-store.ts` → `markAreaStatus()`: `haptic.success()` on complete, `haptic.error()` on blocked
- `crew-store.ts` → `assignWorker()`: `haptic.medium()`
- `crew-store.ts` → `endDay()`: `haptic.heavy()`
- `gps-service.ts` → `recordCheckin()`: `haptic.heavy()`
- AreaDetail checkboxes: `haptic.selection()` on each tap
- Report submit: `haptic.success()`
- Pull-to-refresh: `haptic.light()`

---

## FIX 5 (MEDIUM): takeoff_objects missing from PowerSync sync rules
> Audit check: #5
> Plan overlay won't work offline — takeoff_objects defined in schema but not synced.

**Archivo:** `powersync/sync-rules.yaml`

**Agregar bajo `by_org.data`:**
```yaml
- SELECT * FROM takeoff_objects WHERE organization_id = bucket.organization_id
- SELECT * FROM master_production_targets WHERE organization_id = bucket.organization_id
```

**Deploy:** After editing, redeploy sync rules via PowerSync dashboard or CLI.

---

## FIX 6 (LOW): 15 console.log calls sin __DEV__ guard
> Audit check: #17

**Crear:** `src/shared/lib/logger.ts`
```typescript
export const logger = {
  info: (tag: string, ...args: unknown[]) => {
    if (__DEV__) console.log(`[${tag}]`, ...args);
  },
  warn: (tag: string, ...args: unknown[]) => {
    console.warn(`[${tag}]`, ...args);
  },
  error: (tag: string, ...args: unknown[]) => {
    console.error(`[${tag}]`, ...args);
  },
};
```

**Find-and-replace** en los 10 archivos listados en la auditoría:
```
console.log('[Tag] message') → logger.info('Tag', 'message')
```

---

## FIX 7 (MEDIUM): Solo 1 de 5 forms tiene Zod validation
> Audit check: #20

**Crear Zod schemas para:**

`src/features/tickets/types/schemas.ts`:
```typescript
import { z } from 'zod';
export const CreateTicketSchema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  area_id: z.string().uuid().optional(),
  photos: z.array(z.string()).default([]),
});
```

`src/features/punch/types/schemas.ts`:
```typescript
import { z } from 'zod';
export const CreatePunchItemSchema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  area_id: z.string().uuid(),
  assigned_to: z.string().uuid(),
  photos: z.array(z.string()).min(1, 'At least one photo required'),
});
```

`src/features/production/types/schemas.ts`:
```typescript
import { z } from 'zod';
export const DailyReportSchema = z.object({
  project_id: z.string().uuid(),
  report_date: z.string(),
  areas_worked: z.array(z.string().uuid()).min(1, 'Select at least one area'),
  progress_summary: z.string().optional(),
});
```

**Aplicar** `.safeParse()` antes de cada write en los hooks/services respectivos.

---

## FIX 8 (MEDIUM): No accessibility attributes
> Audit check: #54

**Agregar a componentes principales:**

En ReadyBoard area items:
```typescript
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel={`${area.label} ${area.type}, ${area.progress}% complete, status ${area.status}`}
  accessibilityHint="Double tap to open area details"
>
```

En AreaDetail checkboxes:
```typescript
<TouchableOpacity
  accessibilityRole="checkbox"
  accessibilityState={{ checked: isComplete }}
  accessibilityLabel={`${surface.name}, ${surface.sqft} square feet`}
>
```

En status chips, buttons, FABs — agregar `accessibilityRole` y `accessibilityLabel` en todos.

NO necesitas hacer toda la app ahora — prioriza: ReadyBoard items, AreaDetail checkboxes, navigation tabs, FAB buttons, check-in button.

---

## FIX 9 (LOW): Status chips below 48dp minimum
> Audit check: #46

En ReadyBoard.tsx StatusChip:
```typescript
// ANTES:
<TouchableOpacity style={{ paddingVertical: 6, paddingHorizontal: 12 }}>

// DESPUÉS:
<TouchableOpacity style={{ minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center' }}>
```

En AreaDetail block reason buttons: verificar que `minHeight: 48` está presente.

---

## FIX 10 (LOW): Photo worker sin exponential backoff
> Audit check: #26

En `src/features/photos/services/photo-worker.ts`:

```typescript
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

// In the retry logic:
const retryCount = photo.retry_count || 0;
if (retryCount >= MAX_RETRIES) {
  // Mark as permanently failed
  await markPhotoFailed(photo.id);
  continue;
}

const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount), 60000); // max 60s
await new Promise(resolve => setTimeout(resolve, delay));

// Increment retry count
await powerSync.execute(
  'UPDATE field_photos SET retry_count = ? WHERE id = ?',
  [retryCount + 1, photo.id]
);
```

**Nota:** Puede necesitar agregar columna `retry_count` a field_photos en PowerSync schema.

---

## FIX 11: Agregar production_block_logs al PowerSync schema
> Audit check: #5 (complemento del Fix 2)

**Archivo:** `src/shared/lib/powersync/schema.ts`

Agregar la tabla:
```typescript
production_block_logs: new Table({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  blocked_reason: column.text,
  blocked_at: column.text,
  resolved_at: column.text,
  reported_by: column.text,
  resolved_by: column.text,
  created_at: column.text,
}),
```

Y en `powersync/sync-rules.yaml`:
```yaml
- SELECT * FROM production_block_logs WHERE organization_id = bucket.organization_id
```

---

## VERIFICACIÓN FINAL

Después de aplicar los 11 fixes:
1. `npx tsc --noEmit` — debe pasar sin errores
2. Airplane mode test: mark complete + block + assign crew + take photo → todo offline → reconectar → sync
3. Error boundary test: throw error en un componente → app no crashea, muestra fallback
4. Haptic test: tap checkbox → sientes vibración
5. Block log test: block area → verificar row en production_block_logs
6. Run the audit again — all 11 FAILs should now be PASS

Genera AUDIT_TRACK_FIXES.md con la evidencia de cada fix aplicado.
