/**
 * Next.js API Route - Contact Form Proxy
 *
 * This proxy route solves CORS issues by making the API request from the server-side
 * instead of the client-side. The browser makes a same-origin request to this route,
 * which then forwards the request to the backend API.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();

    // Get the backend API URL from environment variables
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com';

    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/api/v1/contacts/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          detail: errorData.detail || 'Error al enviar el mensaje',
          ...errorData
        },
        { status: response.status }
      );
    }

    // Return the successful response
    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error in contact proxy:', error);
    return NextResponse.json(
      {
        detail: 'Error interno del servidor al procesar la solicitud'
      },
      { status: 500 }
    );
  }
}
