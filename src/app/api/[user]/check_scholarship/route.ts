import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Define types for our database tables
interface User {
  user_id: number;
  annual_income: number;
  first_name: string;
  last_name: string;
}

interface AcademicRecord {
  id: number;
  user_id: number;
  gpa: number;
  program: string;
  year: number;
}

interface ScholarshipProgram {
  scholarship_id: number;
  name: string;
  min_income: number;
  max_income: number;
  gpa_minimum: number;
  max_amount: number;
  description: string;
}

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

    if (userError) {
      return NextResponse.json(
        { error: 'Error fetching user data' },
        { status: 500 }
      );
    }

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch user's academic record
    const { data: academicData, error: academicError } = await supabase
      .from('academic_records')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (academicError) {
      return NextResponse.json(
        { error: 'Error fetching academic records' },
        { status: 500 }
      );
    }

    // Fetch available scholarships
    const { data: scholarships, error: scholarshipError } = await supabase
      .from('scholarship_programs')
      .select('*');

    if (scholarshipError) {
      return NextResponse.json(
        { error: 'Error fetching scholarships' },
        { status: 500 }
      );
    }

    // Filter scholarships based on income and GPA requirements
    const eligibleScholarships = scholarships?.filter(scholarship => {
      const meetsIncome = userData.annual_income >= scholarship.min_income && 
                         userData.annual_income <= scholarship.max_income;
      const meetsGPA = (academicData?.gpa || 0) >= scholarship.gpa_minimum;
      return meetsIncome && meetsGPA;
    }) || [];

    const reasons: string[] = [];
    if (!academicData) {
      reasons.push('No academic records found');
    }

    // Add detailed reasons for ineligibility
    if (eligibleScholarships.length === 0) {
      scholarships?.forEach(scholarship => {
        if (userData.annual_income < scholarship.min_income) {
          reasons.push(`Income below minimum requirement of $${scholarship.min_income} for ${scholarship.name}`);
        } else if (userData.annual_income > scholarship.max_income) {
          reasons.push(`Income above maximum threshold of $${scholarship.max_income} for ${scholarship.name}`);
        }
        if (academicData && academicData.gpa < scholarship.gpa_minimum) {
          reasons.push(`GPA of ${academicData.gpa} does not meet minimum requirement of ${scholarship.gpa_minimum} for ${scholarship.name}`);
        }
      });
    }

    return NextResponse.json({
      eligible: eligibleScholarships.length > 0,
      scholarships: eligibleScholarships,
      userData: {
        annual_income: userData.annual_income,
        gpa: academicData?.gpa || 0
      },
      reasons: reasons.filter((reason, index, self) => self.indexOf(reason) === index) // Remove duplicates
    });

  } catch (error) {
    console.error('Error checking scholarship eligibility:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 