import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface PaymentPlanRequest {
  plan_id: number;
  loan_amount: number;
  down_payment: number;
  start_date?: string;
}

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const monthlyRate = annualRate / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function addMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { user: string } }
) {
  try {
    const userId = params.user;
    const body: PaymentPlanRequest = await request.json();

    // Validate required fields
    if (!body.plan_id || !body.loan_amount || body.down_payment === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists
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

    // Get payment plan details
    const { data: planData, error: planError } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('plan_id', body.plan_id)
      .single();

    if (planError || !planData) {
      return NextResponse.json(
        { error: 'Payment plan not found' },
        { status: 404 }
      );
    }

    // Validate loan amount and down payment against plan requirements
    const minDownPayment = body.loan_amount * planData.min_down_payment;
    if (body.down_payment < minDownPayment) {
      return NextResponse.json(
        { error: `Minimum down payment required: $${minDownPayment}` },
        { status: 400 }
      );
    }

    // Calculate payment details
    const principal = body.loan_amount - body.down_payment;
    const effectiveRate = planData.interest_modifier / 100; // Use plan's interest modifier directly
    const monthlyPayment = calculateMonthlyPayment(principal, effectiveRate, planData.term_months);
    
    // Set start date and next payment date
    const startDate = body.start_date ? new Date(body.start_date) : new Date();
    const nextPaymentDate = addMonths(startDate, 1);

    // Create user payment plan record
    const { data: userPlan, error: insertError } = await supabase
      .from('user_payment_plans')
      .insert({
        user_id: userId,
        plan_id: body.plan_id,
        loan_amount: body.loan_amount,
        down_payment: body.down_payment,
        monthly_payment: monthlyPayment,
        interest_rate: effectiveRate * 100,
        term_months: planData.term_months,
        start_date: startDate.toISOString().split('T')[0],
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
        remaining_balance: principal,
        payments_remaining: planData.term_months,
        status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create payment plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Payment plan started successfully',
      plan: {
        ...userPlan,
        total_payment: (monthlyPayment * planData.term_months).toFixed(2),
        total_interest: (monthlyPayment * planData.term_months - principal).toFixed(2)
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