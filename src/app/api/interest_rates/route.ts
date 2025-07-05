import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    // Get all payment plans with their interest rates
    const { data: plans, error } = await supabase
      .from('payment_plans')
      .select('name, interest_modifier, term_months, description')
      .order('plan_id', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch interest rates' },
        { status: 500 }
      );
    }

    // Format the response to clearly show interest rates
    const formattedPlans = plans.map(plan => ({
      name: plan.name,
      interest_rate: `${plan.interest_modifier.toFixed(2)}%`,
      term_length: `${plan.term_months} months (${(plan.term_months / 12).toFixed(1)} years)`,
      description: plan.description
    }));

    return NextResponse.json({
      message: 'Interest rates retrieved successfully',
      plans: formattedPlans
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 