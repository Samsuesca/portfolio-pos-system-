/**
 * Next.js API Route - Get Contacts by Email
 *
 * This proxy route fetches contacts (PQRS) for a given email address
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { detail: 'Email is required' },
        { status: 400 }
      );
    }

    // Get the backend API URL from environment variables
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com';

    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/api/v1/contacts/by-email?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          detail: errorData.detail || 'Error al buscar contactos',
          ...errorData
        },
        { status: response.status }
      );
    }

    // Return the successful response
    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error in contacts by-email proxy:', error);
    return NextResponse.json(
      {
        detail: 'Error interno del servidor al procesar la solicitud'
      },
      { status: 500 }
    );
  }
}
