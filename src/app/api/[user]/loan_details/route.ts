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

    // Fetch loan details for the user
    const { data: loanData, error: loanError } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (loanError || !loanData) {
      return NextResponse.json(
        { error: 'Loan details not found' },
        { status: 404 }
      );
    }

    // Calculate loan amortization
    const principal = loanData.amount;
    const annualRate = loanData.interest_rate / 100;
    const monthlyRate = annualRate / 12;
    const termMonths = loanData.term_months;
    const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                          (Math.pow(1 + monthlyRate, termMonths) - 1);

    // Generate payment schedule
    const schedule = [];
    let balance = principal;
    let totalInterest = 0;

    for (let month = 1; month <= termMonths; month++) {
      const interest = balance * monthlyRate;
      const principal = monthlyPayment - interest;
      totalInterest += interest;
      balance -= principal;

      schedule.push({
        month,
        payment: monthlyPayment.toFixed(2),
        principal: principal.toFixed(2),
        interest: interest.toFixed(2),
        balance: Math.max(0, balance).toFixed(2)
      });
    }

    return NextResponse.json({
      loan_details: {
        principal: loanData.amount.toFixed(2),
        interest_rate: loanData.interest_rate.toFixed(2) + '%',
        term_months: loanData.term_months,
        monthly_payment: monthlyPayment.toFixed(2),
        total_payment: (monthlyPayment * termMonths).toFixed(2),
        total_interest: totalInterest.toFixed(2)
      },
      payment_schedule: schedule
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 