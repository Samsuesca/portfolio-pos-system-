/**
 * HTTP Client module for Tauri
 *
 * This module provides HTTP request functionality via Rust's reqwest library,
 * bypassing WebView2's buggy tauriFetch implementation on Windows.
 *
 * The bug: tauriFetch's response.json()/text()/arrayBuffer() hangs indefinitely
 * on Windows WebView2 in production builds.
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_secs: Option<u64>,
}

#[tauri::command]
pub async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(request.timeout_secs.unwrap_or(30)))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req_builder = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&request.url),
        "POST" => client.post(&request.url),
        "PUT" => client.put(&request.url),
        "PATCH" => client.patch(&request.url),
        "DELETE" => client.delete(&request.url),
        _ => return Err(format!("Unsupported HTTP method: {}", request.method)),
    };

    if let Some(headers) = request.headers {
        for (key, value) in headers {
            req_builder = req_builder.header(&key, &value);
        }
    }

    if let Some(body) = request.body {
        req_builder = req_builder.body(body);
    }

    let response = req_builder
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Error reading response: {}", e))?;

    Ok(HttpResponse { status, body })
}
