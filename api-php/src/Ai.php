<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Pasarela de IA propia.
 *
 * La aplicación llama a  POST /api/v1/ai/chat/completions  con el mismo formato
 * que OpenAI, y este archivo reenvía la petición a Google Gemini (que ofrece un
 * endpoint compatible) usando la clave guardada en el .env del servidor.
 *
 * Así la clave nunca sale del hosting y la aplicación deja de depender de la
 * pasarela de Lovable.
 */
final class Ai
{
    public function __construct(
        private string $geminiKey,
        private string $openaiKey = '',
    ) {
    }

    /** Reenvía la petición al proveedor y devuelve la respuesta tal cual. */
    public function proxy(string $subPath, string $method): void
    {
        $subPath = '/' . ltrim($subPath, '/');
        $body = file_get_contents('php://input');
        $body = is_string($body) ? $body : '';

        $payload = json_decode($body === '' ? '{}' : $body, true);
        $model = is_array($payload) ? (string) ($payload['model'] ?? '') : '';

        // Elegimos proveedor por el nombre del modelo.
        $useOpenAi = $this->openaiKey !== '' && (str_starts_with($model, 'gpt-') || str_starts_with($model, 'o1') || str_starts_with($model, 'o3'));

        if ($useOpenAi) {
            $base = 'https://api.openai.com/v1';
            $key = $this->openaiKey;
        } else {
            if ($this->geminiKey === '') {
                Http::fail('La IA no está configurada en el servidor (falta GEMINI_API_KEY)', 503, 'ai_not_configured');
            }
            $base = 'https://generativelanguage.googleapis.com/v1beta/openai';
            $key = $this->geminiKey;
        }

        $ch = curl_init($base . $subPath);
        if ($ch === false) {
            Http::fail('No se ha podido contactar con el proveedor de IA', 502, 'ai_unavailable');
        }

        $isStream = is_array($payload) && !empty($payload['stream']);
        $headersOut = [];

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $key,
                'Content-Type: application/json',
                'Accept: ' . ($isStream ? 'text/event-stream' : 'application/json'),
            ],
            CURLOPT_POSTFIELDS => $method === 'GET' ? null : $body,
            CURLOPT_RETURNTRANSFER => !$isStream,
            CURLOPT_TIMEOUT => 600,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$headersOut): int {
                $headersOut[] = $line;
                return strlen($line);
            },
        ]);

        if ($isStream) {
            // Respuesta en directo: la reenviamos tal cual, trozo a trozo.
            header('Content-Type: text/event-stream; charset=utf-8');
            header('Cache-Control: no-cache');
            header('X-Accel-Buffering: no');
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, static function ($ch, string $chunk): int {
                echo $chunk;
                flush();
                return strlen($chunk);
            });
            curl_exec($ch);
            curl_close($ch);
            exit;
        }

        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if (!is_string($response) || $response === '') {
            error_log('[ai] ' . $error);
            Http::fail('El proveedor de IA no ha respondido', 502, 'ai_unavailable');
        }

        http_response_code($status > 0 ? $status : 502);
        header('Content-Type: application/json; charset=utf-8');
        echo $response;
        exit;
    }
}
