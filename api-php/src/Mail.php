<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Envío de correo por el SMTP del hosting (fase B), sin dependencias externas.
 * Suficiente para correo transaccional: texto + HTML y varios destinatarios.
 */
final class Mail
{
    private string $host;
    private int $port;
    private string $user;
    private string $pass;
    private bool $starttls = false;

    public function __construct(string $host, int $port, string $user, string $pass)
    {
        $this->host = $host;
        $this->port = $port;
        $this->user = $user;
        $this->pass = $pass;
    }

    /**
     * POST /api/v1/email/send
     * { to: string|string[], subject: string, html?: string, text?: string,
     *   reply_to?: string, idempotency_key?: string }
     *
     * @return array{sent: bool, to: string[], message_id: string}
     */
    public function send(array $body): array
    {
        $tos = $body['to'] ?? [];
        if (is_string($tos)) {
            $tos = [$tos];
        }
        if (!is_array($tos) || $tos === []) {
            Http::fail('Falta el destinatario', 400, 'missing_to');
        }
        $tos = array_values(array_unique(array_map(
            static fn ($t): string => strtolower(trim((string) $t)),
            $tos,
        )));
        foreach ($tos as $to) {
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                Http::fail('Destinatario no válido', 400, 'bad_recipient');
            }
        }

        $subject = trim((string) ($body['subject'] ?? ''));
        $html = (string) ($body['html'] ?? '');
        $text = (string) ($body['text'] ?? '');
        if ($subject === '') {
            Http::fail('Falta el asunto', 400, 'missing_subject');
        }
        if ($html === '' && $text === '') {
            Http::fail('Falta el contenido del correo', 400, 'missing_body');
        }
        if (mb_strlen($html) > 1000000 || mb_strlen($text) > 500000) {
            Http::fail('Contenido demasiado grande', 413, 'payload_too_large');
        }

        $from = (string) (Env::get('SMTP_FROM', '') ?? '');
        if (!filter_var($from, FILTER_VALIDATE_EMAIL)) {
            throw new \RuntimeException('Falta la variable de configuración SMTP_FROM');
        }
        $fromName = (string) (Env::get('SMTP_FROM_NAME', 'Xandralyze') ?? 'Xandralyze');

        $replyTo = (string) ($body['reply_to'] ?? '');
        if (!filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $replyTo = '';
        }

        $key = preg_replace('/[^a-zA-Z0-9]/', '', (string) ($body['idempotency_key'] ?? ''));
        $messageId = '<' . ($key !== '' ? substr($key, 0, 48) . '.' : '')
            . bin2hex(random_bytes(12)) . '@' . substr(strrchr($from, '@'), 1) . '>';

        $message = $this->buildMessage($from, $fromName, $tos, $subject, $html, $text, $replyTo, $messageId);
        $this->deliver($message, $from, $tos);

        return ['sent' => true, 'to' => $tos, 'message_id' => $messageId];
    }

    private function deliver(string $message, string $from, array $tos): void
    {
        $socket = $this->connect();
        try {
            $this->command($socket, 'EHLO xandralyze.com', [250]);
            if ($this->starttls) {
                $this->command($socket, 'STARTTLS', [220]);
                if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new \RuntimeException('No se pudo cifrar la conexión SMTP (STARTTLS)');
                }
                $this->command($socket, 'EHLO xandralyze.com', [250]);
            }
            if ($this->user !== '') {
                $this->command($socket, 'AUTH LOGIN', [334]);
                $this->command($socket, base64_encode($this->user), [334]);
                $this->command($socket, base64_encode($this->pass), [235]);
            }
            $this->command($socket, 'MAIL FROM:<' . $from . '>', [250]);
            foreach ($tos as $to) {
                $this->command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
            }
            $this->command($socket, 'DATA', [354]);
            $this->data($socket, $message);
            $this->command($socket, 'QUIT', [221]);
        } finally {
            fclose($socket);
        }
    }

    /** @return resource */
    private function connect()
    {
        $mode = strtolower((string) (Env::get('SMTP_SECURE', '') ?? ''));
        if ($mode === '') {
            $mode = $this->port === 465 ? 'ssl' : 'tls';
        }
        $transport = $mode === 'ssl' ? 'ssl' : 'tcp';

        $socket = @stream_socket_client(
            sprintf('%s://%s:%d', $transport, $this->host, $this->port),
            $errno,
            $errstr,
            15
        );
        if ($socket === false) {
            throw new \RuntimeException("No se pudo conectar al servidor SMTP {$this->host}:{$this->port} ({$errstr})");
        }
        stream_set_timeout($socket, 20);
        $this->expect($socket, [220]);
        $this->starttls = ($transport === 'tcp' && $mode !== 'none');

        return $socket;
    }

    /**
     * @param resource $socket
     * @param int[]    $codes
     */
    private function command($socket, string $line, array $codes): string
    {
        fwrite($socket, $line . "\r\n");

        return $this->expect($socket, $codes);
    }

    /**
     * @param resource $socket
     * @param int[]    $codes
     */
    private function expect($socket, array $codes): string
    {
        $response = '';
        do {
            $line = fgets($socket, 1024);
            if ($line === false) {
                throw new \RuntimeException('El servidor SMTP cerró la conexión inesperadamente');
            }
            $response .= $line;
        } while (isset($line[3]) && $line[3] === '-');

        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new \RuntimeException('El servidor SMTP rechazó la petición: ' . trim($response));
        }

        return $response;
    }

    /** @param resource $socket */
    private function data($socket, string $message): void
    {
        $lines = preg_split('/\r\n|\r|\n/', $message) ?: [];
        foreach ($lines as $line) {
            if (str_starts_with($line, '.')) {
                $line = '.' . $line; // dot-stuffing RFC 5321
            }
            fwrite($socket, $line . "\r\n");
        }
        fwrite($socket, ".\r\n");
        $this->expect($socket, [250]);
    }

    private function buildMessage(
        string $from,
        string $fromName,
        array $tos,
        string $subject,
        string $html,
        string $text,
        string $replyTo,
        string $messageId
    ): string {
        $headers = [
            'Date: ' . date('r'),
            'From: ' . $this->encodedWord($fromName) . ' <' . $from . '>',
            'To: ' . implode(', ', $tos),
            'Subject: ' . $this->encodedWord($subject),
            'Message-ID: ' . $messageId,
            'MIME-Version: 1.0',
        ];
        if ($replyTo !== '') {
            $headers[] = 'Reply-To: ' . $replyTo;
        }

        $boundary = '=xandralyze_' . bin2hex(random_bytes(12));
        $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';

        $parts = '';
        if ($text !== '') {
            $parts .= '--' . $boundary . "\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
                . quoted_printable_encode($text) . "\r\n";
        }
        if ($html !== '') {
            $parts .= '--' . $boundary . "\r\n"
                . "Content-Type: text/html; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
                . quoted_printable_encode($html) . "\r\n";
        }
        $parts .= '--' . $boundary . "--\r\n";

        return implode("\r\n", $headers) . "\r\n\r\n" . $parts;
    }

    private function encodedWord(string $value): string
    {
        return preg_match('/[\x80-\xFF]/', $value) === 1
            ? '=?UTF-8?B?' . base64_encode($value) . '?='
            : $value;
    }
}
