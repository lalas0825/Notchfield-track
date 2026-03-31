/**
 * Seed Script — NotchField Track
 * ================================
 * Populates the shared Supabase DB with realistic construction data.
 * Idempotent: deletes existing seed data before inserting.
 *
 * Run: npx tsx scripts/seed.ts
 *
 * Uses the "Jantile, Group" org (383 Madison Ave project)
 * where Juan Restrepo (owner) is the logged-in user.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://msmpsxalfalzinuorwlg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  console.error('Run: SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/seed.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Constants ────────────────────────────────────────────
const ORG_ID = '9a7b756b-cfc8-455a-bdcd-3a9b13b2f7de'; // Jantile, Group
const PROJECT_ID = '223bfdda-27ac-4e3a-95ea-6217ce84dacc'; // 383 Madison Ave
const OWNER_ID = '52bb7bac-0039-4800-8027-5b2a0e4a125b'; // Juan Restrepo

// Deterministic UUIDs for seed data (so we can delete + re-insert)
const WORKER_IDS = {
  carlos: 'aaaa0001-0001-0001-0001-000000000001',
  mario: 'aaaa0001-0001-0001-0001-000000000002',
  pedro: 'aaaa0001-0001-0001-0001-000000000003',
  luis: 'aaaa0001-0001-0001-0001-000000000004',
  miguel: 'aaaa0001-0001-0001-0001-000000000005',
};

const AREA_IDS = {
  l1e1: 'bbbb0001-0001-0001-0001-000000000001',
  l1e2: 'bbbb0001-0001-0001-0001-000000000002',
  l2e1: 'bbbb0001-0001-0001-0001-000000000003',
  l2e2: 'bbbb0001-0001-0001-0001-000000000004',
  l3e1: 'bbbb0001-0001-0001-0001-000000000005',
  l3e2: 'bbbb0001-0001-0001-0001-000000000006',
  l3e3: 'bbbb0001-0001-0001-0001-000000000007',
  l3e4: 'bbbb0001-0001-0001-0001-000000000008',
};

const TEMPLATE_ID = 'cccc0001-0001-0001-0001-000000000001';
const GEOFENCE_ID = 'dddd0001-0001-0001-0001-000000000001';

// 383 Madison Ave, NYC coordinates
const SITE_LAT = 40.7567;
const SITE_LNG = -73.9718;

async function clean() {
  console.log('🧹 Cleaning existing seed data...');

  // Delete in FK order
  const seedAreaIds = Object.values(AREA_IDS);
  const seedWorkerIds = Object.values(WORKER_IDS);

  await supabase.from('production_phase_progress').delete().in('area_id', seedAreaIds);
  await supabase.from('production_area_objects').delete().in('area_id', seedAreaIds);
  await supabase.from('crew_assignments').delete().in('worker_id', seedWorkerIds);
  await supabase.from('area_time_entries').delete().in('area_id', seedAreaIds);
  await supabase.from('field_messages').delete().in('area_id', seedAreaIds);
  await supabase.from('punch_items').delete().in('area_id', seedAreaIds);
  await supabase.from('daily_reports').delete().eq('project_id', PROJECT_ID);
  await supabase.from('gps_checkins').delete().eq('project_id', PROJECT_ID);
  await supabase.from('production_areas').delete().in('id', seedAreaIds);
  await supabase.from('production_template_phases').delete().eq('template_id', TEMPLATE_ID);
  await supabase.from('production_templates').delete().eq('id', TEMPLATE_ID);
  await supabase.from('gps_geofences').delete().eq('id', GEOFENCE_ID);
  await supabase.from('safety_documents').delete().eq('project_id', PROJECT_ID);

  // Delete seed worker profiles (but NOT the owner)
  for (const id of seedWorkerIds) {
    await supabase.from('profiles').delete().eq('id', id);
  }

  console.log('✅ Clean complete');
}

async function seedWorkers() {
  console.log('👷 Creating workers...');

  const workers = [
    { id: WORKER_IDS.carlos, full_name: 'Carlos Mendez', role: 'foreman' },
    { id: WORKER_IDS.mario, full_name: 'Mario Santos', role: 'foreman' },
    { id: WORKER_IDS.pedro, full_name: 'Pedro Rivera', role: 'foreman' },
    { id: WORKER_IDS.luis, full_name: 'Luis Herrera', role: 'foreman' },
    { id: WORKER_IDS.miguel, full_name: 'Miguel Torres', role: 'foreman' },
  ];

  // Create auth users first (required for FK to profiles)
  for (const w of workers) {
    const email = `${w.full_name.toLowerCase().replace(' ', '.')}@jantile.com`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'Track2026!',
      email_confirm: true,
      user_metadata: { name: w.full_name, role: w.role },
    });

    if (authError && !authError.message.includes('already been registered')) {
      console.error(`  ❌ Auth user ${w.full_name}:`, authError.message);
      continue;
    }

    // Update profile with correct org + role
    const userId = authUser?.user?.id ?? w.id;
    await supabase.from('profiles').upsert({
      id: userId,
      organization_id: ORG_ID,
      full_name: w.full_name,
      role: w.role,
      locale: 'es',
      is_active: true,
    });

    // Update our ID map if the auth system gave a different UUID
    const key = Object.keys(WORKER_IDS).find(k => (WORKER_IDS as any)[k] === w.id);
    if (key && userId !== w.id) {
      (WORKER_IDS as any)[key] = userId;
    }

    console.log(`  ✅ ${w.full_name} (${w.role}) — ${email}`);
  }
}

async function seedTemplate() {
  console.log('📋 Creating production template...');

  await supabase.from('production_templates').upsert({
    id: TEMPLATE_ID,
    organization_id: ORG_ID,
    name: 'Bathroom — Standard',
    created_at: new Date().toISOString(),
  });

  const phases = [
    { name: 'Soundproof', sequence: 1, requires_inspection: false, estimated_duration_hours: 4, crew_size: 2, crew_role: 'mechanic', is_optional: false, wait_hours_after: 0 },
    { name: 'Mud Float', sequence: 2, requires_inspection: false, estimated_duration_hours: 6, crew_size: 2, crew_role: 'mechanic', is_optional: false, wait_hours_after: 24 },
    { name: 'Waterproof', sequence: 3, requires_inspection: true, estimated_duration_hours: 3, crew_size: 2, crew_role: 'mechanic', is_optional: false, wait_hours_after: 0 },
    { name: 'Tile Install', sequence: 4, requires_inspection: false, estimated_duration_hours: 16, crew_size: 2, crew_role: 'mechanic', is_optional: false, wait_hours_after: 0 },
    { name: 'Grout', sequence: 5, requires_inspection: true, estimated_duration_hours: 4, crew_size: 1, crew_role: 'mechanic', is_optional: false, wait_hours_after: 24 },
  ];

  for (const p of phases) {
    await supabase.from('production_template_phases').insert({
      template_id: TEMPLATE_ID,
      organization_id: ORG_ID,
      ...p,
      depends_on_phase: p.sequence > 1 ? p.sequence - 1 : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`  ✅ Template "Bathroom — Standard" with ${phases.length} phases (2 gates)`);
}

async function seedAreas() {
  console.log('🏗️ Creating production areas...');

  const areas = [
    { id: AREA_IDS.l1e1, name: 'L1-E1', floor: 'Floor L1', zone: 'East', status: 'complete', completed_at: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: AREA_IDS.l1e2, name: 'L1-E2', floor: 'Floor L1', zone: 'East', status: 'in_progress', started_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: AREA_IDS.l2e1, name: 'L2-E1', floor: 'Floor L2', zone: 'East', status: 'blocked', blocked_reason: 'other_trade', blocked_at: new Date(Date.now() - 86400000).toISOString() },
    { id: AREA_IDS.l2e2, name: 'L2-E2', floor: 'Floor L2', zone: 'East', status: 'in_progress', started_at: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: AREA_IDS.l3e1, name: 'L3-E1', floor: 'Floor L3', zone: 'East', status: 'not_started' },
    { id: AREA_IDS.l3e2, name: 'L3-E2', floor: 'Floor L3', zone: 'East', status: 'not_started' },
    { id: AREA_IDS.l3e3, name: 'L3-E3', floor: 'Floor L3', zone: 'West', status: 'in_progress', started_at: new Date(Date.now() - 86400000).toISOString() },
    { id: AREA_IDS.l3e4, name: 'L3-E4', floor: 'Floor L3', zone: 'West', status: 'blocked', blocked_reason: 'material', blocked_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  ];

  for (const area of areas) {
    await supabase.from('production_areas').upsert({
      ...area,
      project_id: PROJECT_ID,
      organization_id: ORG_ID,
      template_id: TEMPLATE_ID,
      quantity: Math.floor(Math.random() * 200 + 50),
      unit_type: 'sqft',
      created_by: OWNER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`  ✅ ${area.name} — ${area.floor} — ${area.status}`);
  }
}

async function seedPhaseProgress() {
  console.log('📊 Creating phase progress...');

  // Get template phases
  const { data: phases } = await supabase
    .from('production_template_phases')
    .select('id, sequence, name')
    .eq('template_id', TEMPLATE_ID)
    .order('sequence');

  if (!phases || phases.length === 0) {
    console.log('  ⚠️ No template phases found — skipping');
    return;
  }

  // L1-E1 (complete) — all phases done
  for (const phase of phases) {
    await supabase.from('production_phase_progress').insert({
      area_id: AREA_IDS.l1e1,
      phase_id: phase.id,
      organization_id: ORG_ID,
      status: 'complete',
      percent_complete: 100,
      completed_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      completed_by: OWNER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  console.log('  ✅ L1-E1: all 5 phases complete');

  // L1-E2 (in progress) — 3 of 5 done, currently on Tile Install
  for (const phase of phases) {
    const done = phase.sequence <= 3;
    await supabase.from('production_phase_progress').insert({
      area_id: AREA_IDS.l1e2,
      phase_id: phase.id,
      organization_id: ORG_ID,
      status: done ? 'complete' : (phase.sequence === 4 ? 'in_progress' : 'not_started'),
      percent_complete: done ? 100 : (phase.sequence === 4 ? 45 : 0),
      completed_at: done ? new Date(Date.now() - 86400000 * (6 - phase.sequence)).toISOString() : null,
      completed_by: done ? OWNER_ID : null,
      started_at: phase.sequence === 4 ? new Date(Date.now() - 86400000).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  console.log('  ✅ L1-E2: 3/5 phases complete, Tile Install in progress');

  // L2-E2 (in progress) — 2 of 5 done
  for (const phase of phases) {
    const done = phase.sequence <= 2;
    await supabase.from('production_phase_progress').insert({
      area_id: AREA_IDS.l2e2,
      phase_id: phase.id,
      organization_id: ORG_ID,
      status: done ? 'complete' : 'not_started',
      percent_complete: done ? 100 : 0,
      completed_at: done ? new Date(Date.now() - 86400000 * 2).toISOString() : null,
      completed_by: done ? OWNER_ID : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  console.log('  ✅ L2-E2: 2/5 phases complete');

  // L3-E3 (in progress) — 1 of 5 done
  for (const phase of phases) {
    const done = phase.sequence <= 1;
    await supabase.from('production_phase_progress').insert({
      area_id: AREA_IDS.l3e3,
      phase_id: phase.id,
      organization_id: ORG_ID,
      status: done ? 'complete' : 'not_started',
      percent_complete: done ? 100 : 0,
      completed_at: done ? new Date(Date.now() - 86400000).toISOString() : null,
      completed_by: done ? OWNER_ID : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  console.log('  ✅ L3-E3: 1/5 phases complete');
}

async function seedGeofence() {
  console.log('📍 Creating geofence...');

  await supabase.from('gps_geofences').upsert({
    id: GEOFENCE_ID,
    project_id: PROJECT_ID,
    organization_id: ORG_ID,
    center_lat: SITE_LAT,
    center_lng: SITE_LNG,
    radius_meters: 200,
    name: '383 Madison Ave — Job Site',
    is_active: true,
    created_by: OWNER_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  console.log(`  ✅ Geofence: ${SITE_LAT}, ${SITE_LNG} — 200m radius`);
}

async function seedSafetyDocs() {
  console.log('🦺 Creating safety documents...');

  const docs = [
    {
      doc_type: 'jha',
      title: 'JHA — Tile Installation Floor L1',
      content: {
        location: '383 Madison Ave, Floor L1',
        weather: 'Indoor — 72°F',
        hazards: [
          { description: 'Wet surfaces from tile cutting', risk_level: 'medium', controls: 'Non-slip mats, warning signs', ppe: ['Steel-Toe Boots', 'Safety Glasses', 'Gloves'] },
          { description: 'Silica dust from cutting', risk_level: 'high', controls: 'Wet cutting, ventilation', ppe: ['Respirator', 'Safety Glasses'] },
        ],
      },
      status: 'active',
      signatures: [{ signer_name: 'Juan Restrepo', signature_data: 'sig-placeholder', signed_at: new Date().toISOString() }],
    },
    {
      doc_type: 'ptp',
      title: 'PTP — Waterproof Application L2',
      content: {
        location: '383 Madison Ave, Floor L2',
        crew_members: ['Carlos Mendez', 'Mario Santos'],
        tasks: [
          { task: 'Apply waterproof membrane', hazards: 'Chemical exposure', controls: 'Ventilation, PPE' },
          { task: 'Flood test verification', hazards: 'Slip hazard', controls: 'Barriers, signage' },
        ],
      },
      status: 'active',
      signatures: [{ signer_name: 'Juan Restrepo', signature_data: 'sig-placeholder', signed_at: new Date().toISOString() }],
    },
    {
      doc_type: 'toolbox_talk',
      title: 'Toolbox Talk — Weekly Safety Meeting',
      content: {
        topic: 'Heat stress prevention in enclosed spaces',
        discussion_points: ['Hydration schedule', 'Signs of heat exhaustion', 'Break frequency', 'Emergency procedures'],
        attendance: ['Juan Restrepo', 'Carlos Mendez', 'Mario Santos', 'Pedro Rivera', 'Luis Herrera'],
      },
      status: 'active',
      signatures: [{ signer_name: 'Juan Restrepo', signature_data: 'sig-placeholder', signed_at: new Date().toISOString() }],
    },
  ];

  for (const doc of docs) {
    const { error } = await supabase.from('safety_documents').insert({
      project_id: PROJECT_ID,
      organization_id: ORG_ID,
      ...doc,
      created_by: OWNER_ID,
    });
    if (error) {
      console.error(`  ❌ ${doc.title}:`, error.message);
    } else {
      console.log(`  ✅ ${doc.title}`);
    }
  }
}

async function seedWorkTickets() {
  console.log('🔧 Creating work tickets...');

  const tickets = [
    { title: 'Cracked substrate L2-E1', description: 'Found crack in substrate near NE corner during prep work.', status: 'draft', floor: 'Floor L2', area: 'L2-E1' },
    { title: 'Missing threshold L1-E2', description: 'Marble threshold not delivered. Need 4.5 LF saddle.', status: 'submitted', floor: 'Floor L1', area: 'L1-E2' },
  ];

  for (const t of tickets) {
    const { error } = await supabase.from('work_tickets').insert({
      project_id: PROJECT_ID,
      organization_id: ORG_ID,
      ...t,
      photos: [],
      created_by: OWNER_ID,
    });
    if (error) {
      console.error(`  ❌ ${t.title}:`, error.message);
    } else {
      console.log(`  ✅ ${t.title} (${t.status})`);
    }
  }
}

async function main() {
  console.log('\n🌱 NotchField Track — Seed Script');
  console.log('================================\n');
  console.log(`Org: Jantile, Group (${ORG_ID})`);
  console.log(`Project: 383 Madison Ave (${PROJECT_ID})`);
  console.log(`Owner: Juan Restrepo (${OWNER_ID})\n`);

  await clean();
  await seedWorkers();
  await seedTemplate();
  await seedAreas();
  await seedPhaseProgress();
  await seedGeofence();
  await seedSafetyDocs();
  await seedWorkTickets();

  console.log('\n🎉 Seed complete! Data ready for testing.\n');
  console.log('Workers login: <name>@jantile.com / Track2026!');
  console.log('Areas: 8 (1 complete, 3 in-progress, 2 blocked, 2 not-started)');
  console.log('Template: Bathroom — Standard (5 phases, 2 gates)');
  console.log(`Geofence: 383 Madison Ave (${SITE_LAT}, ${SITE_LNG}) — 200m\n`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
