/**
 * Next.js API Route - Payment Proof Upload Proxy
 *
 * This proxy route solves CORS issues by making the API request from the server-side
 * instead of the client-side. The browser makes a same-origin request to this route,
 * which then forwards the multipart/form-data request to the backend API.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    console.log('[Upload Proxy] Starting upload for order:', orderId);

    // Get the form data from the request
    const formData = await request.formData();
    console.log('[Upload Proxy] FormData received, keys:', Array.from(formData.keys()));

    // Extract notes from FormData if present (backend expects it as query param)
    const notes = formData.get('notes');
    const file = formData.get('file');

    console.log('[Upload Proxy] Notes:', notes);
    console.log('[Upload Proxy] File:', file ? `${file.constructor.name}, size: ${(file as File).size}` : 'null');

    if (!file) {
      console.error('[Upload Proxy] No file in FormData');
      return NextResponse.json(
        { detail: 'No se recibió ningún archivo' },
        { status: 400 }
      );
    }

    // Create new FormData with only the file
    const backendFormData = new FormData();
    backendFormData.append('file', file);

    // Get the backend API URL from environment variables
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com';

    // Build URL with payment_notes query parameter if provided
    let url = `${API_URL}/api/v1/portal/orders/${orderId}/upload-payment-proof`;
    if (notes && typeof notes === 'string' && notes.trim()) {
      url += `?payment_notes=${encodeURIComponent(notes.trim())}`;
    }

    console.log('[Upload Proxy] Forwarding to:', url);

    // Forward the request to the backend API
    const response = await fetch(url, {
      method: 'POST',
      body: backendFormData,
    });

    console.log('[Upload Proxy] Backend response status:', response.status);

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Upload Proxy] Backend error:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText || 'Error al subir el comprobante' };
      }

      return NextResponse.json(
        {
          detail: errorData.detail || 'Error al subir el comprobante',
          ...errorData
        },
        { status: response.status }
      );
    }

    // Return the successful response
    const data = await response.json();
    console.log('[Upload Proxy] Success:', data);
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('[Upload Proxy] Exception:', error);
    return NextResponse.json(
      {
        detail: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
