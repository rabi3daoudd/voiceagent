import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  'https://wnpqlnhebgtyoexgjnur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducHFsbmhlYmd0eW9leGdqbnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcyNzgsImV4cCI6MjA2NzMxMzI3OH0.ztPMjKmZIwEmSRMFDu3iuTmjIk6CPNUs9Q_F7S6APPM'
);

interface PaymentPlan {
  plan_id: number;
  name: string;
  description: string;
  term_months: number;
  interest_modifier: number;
  min_down_payment: number;
}

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const monthlyRate = annualRate / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for loan amount
    const searchParams = request.nextUrl.searchParams;
    const loanAmount = parseFloat(searchParams.get('amount') || '10000');

    // Fetch available payment plans
    const { data: plans, error } = await supabase
      .from('payment_plans')
      .select('*')
      .order('term_months');

    if (error) {
      return NextResponse.json(
        { error: 'Error fetching payment plans' },
        { status: 500 }
      );
    }

    // Calculate payment examples for each plan
    const plansWithExamples = plans?.map((plan: PaymentPlan) => {
      const baseRate = 4.5; // Base interest rate
      const effectiveRate = (baseRate + plan.interest_modifier) / 100;
      const principal = loanAmount * (1 - plan.min_down_payment);
      const monthlyPayment = calculateMonthlyPayment(principal, effectiveRate, plan.term_months);
      const totalPayment = monthlyPayment * plan.term_months;
      const totalInterest = totalPayment - principal;
      const requiredDownPayment = loanAmount * plan.min_down_payment;

      return {
        ...plan,
        example: {
          loanAmount,
          requiredDownPayment,
          principal,
          effectiveInterestRate: (effectiveRate * 100).toFixed(2),
          monthlyPayment: monthlyPayment.toFixed(2),
          totalPayment: totalPayment.toFixed(2),
          totalInterest: totalInterest.toFixed(2),
          termYears: (plan.term_months / 12).toFixed(1)
        }
      };
    });

    return NextResponse.json({
      plans: plansWithExamples
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 