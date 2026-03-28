import { Stack } from 'expo-router';
import { TicketForm } from '@/features/tickets/components/TicketForm';

export default function NewTicketScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'New Work Ticket',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <TicketForm />
    </>
  );
}
