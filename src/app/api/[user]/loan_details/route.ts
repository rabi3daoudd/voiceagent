import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!process.env.NEXT_PUBLIC_BASE_INTEREST_RATE) throw new Error('Missing env.NEXT_PUBLIC_BASE_INTEREST_RATE');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface LoanDetails {
  loan_id: number;
  user_id: number;
  principal_amount: number;
  interest_rate: number;
  loan_term_months: number;
  start_date: string;
  status: string;
}

function calculateLoanDetails(loan: LoanDetails) {
  // Convert interest rate to monthly decimal (e.g., 4.5% annual becomes 0.00375 monthly)
  const monthlyRate = (loan.interest_rate / 100) / 12;
  const totalPayments = loan.loan_term_months;
  
  // Calculate monthly payment using the loan amortization formula
  const monthlyPayment = 
    (loan.principal_amount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
    (Math.pow(1 + monthlyRate, totalPayments) - 1);
  
  // Calculate total amount to be paid
  const totalAmount = monthlyPayment * totalPayments;
  
  // Calculate total interest
  const totalInterest = totalAmount - loan.principal_amount;
  
  // Calculate number of payments made (months since start_date)
  const startDate = new Date(loan.start_date);
  const today = new Date();
  const monthsPassed = Math.max(0,
    (today.getFullYear() - startDate.getFullYear()) * 12 + 
    (today.getMonth() - startDate.getMonth())
  );
  
  // Calculate remaining balance using amortization formula
  const remainingPayments = Math.max(0, totalPayments - monthsPassed);
  let remainingBalance = loan.principal_amount;
  
  if (monthsPassed > 0) {
    remainingBalance = (monthlyPayment * ((1 - Math.pow(1 + monthlyRate, -remainingPayments)) / monthlyRate));
  }

  return {
    principal: loan.principal_amount.toFixed(2),
    monthlyPayment: monthlyPayment.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
    loanTermMonths: loan.loan_term_months,
    interestRate: loan.interest_rate.toFixed(2),
    remainingBalance: remainingBalance.toFixed(2),
    monthsPassed,
    remainingPayments,
    percentagePaid: ((monthsPassed / totalPayments) * 100).toFixed(1)
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { user: string } }
) {
  try {
    const userId = params.user;

    // Fetch loan details for the user
    const { data: loanData, error: loanError } = await supabase
      .from('loan_details')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (loanError) {
      return NextResponse.json(
        { error: 'Error fetching loan details' },
        { status: 500 }
      );
    }

    if (!loanData) {
      return NextResponse.json(
        { error: 'No loan found for this user' },
        { status: 404 }
      );
    }

    // Calculate loan details
    const loanDetails = calculateLoanDetails(loanData);

    // Fetch user data for context
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'Error fetching user data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: userData,
      loanStatus: loanData.status,
      ...loanDetails,
      paymentSchedule: {
        firstPaymentDate: new Date(loanData.start_date).toISOString().split('T')[0],
        lastPaymentDate: new Date(new Date(loanData.start_date).setMonth(
          new Date(loanData.start_date).getMonth() + loanData.loan_term_months - 1
        )).toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Error calculating loan details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 