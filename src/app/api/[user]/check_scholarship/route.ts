import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(
  request: NextRequest,
  { params }: { params: { user: string } }
) {
  try {
    const userId = params.user;

    // Fetch user data including annual income
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check eligibility based on income and GPA
    const isEligible = userData.annual_income <= 50000 && userData.gpa >= 3.0;

    return NextResponse.json({
      eligible: isEligible,
      factors: {
        income_eligible: userData.annual_income <= 50000,
        gpa_eligible: userData.gpa >= 3.0,
        current_income: userData.annual_income,
        current_gpa: userData.gpa
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 