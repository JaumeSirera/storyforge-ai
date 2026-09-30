<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Pagos con Redsys en tu propio servidor (firma HMAC_SHA256_V1, pago con
 * formulario, notificación y cobros recurrentes con la tarjeta guardada).
 *
 * Rutas (ver public/index.php):
 *   POST /api/v1/redsys/notification      pública: la llama Redsys (se verifica la firma)
 *   POST /api/v1/redsys/checkout          { amount_cents?, description?, origin }
 *   POST /api/v1/redsys/pay-extra         { origin }
 *   POST /api/v1/redsys/charge-recurring  solo modo servicio / tarea programada
 */
final class Redsys
{
    private Db $db;
    private string $key;
    private string $code;
    private string $terminal;
    private string $name;
    private string $urlTpv;
    private string $urlRest;
    private string $notifyUrl;

    public function __construct(Db $db, string $notifyUrl)
    {
        $this->db = $db;
        $this->key = Env::require('REDSYS_MERCHANT_KEY');
        $this->code = Env::require('REDSYS_MERCHANT_CODE');
        $this->terminal = Env::get('REDSYS_TERMINAL', '1') ?? '1';
        $this->name = Env::get('REDSYS_MERCHANT_NAME', 'Xandralyze') ?? 'Xandralyze';
        $env = strtolower(Env::get('REDSYS_ENV', 'production') ?? 'production');
        $prod = in_array($env, ['production', 'prod', 'live'], true);
        $host = $prod ? 'https://sis.redsys.es' : 'https://sis-t.redsys.es:25443';
        $this->urlTpv = $host . '/sis/realizarPago';
        $this->urlRest = $host . '/sis/rest/trataPeticionREST';
        $this->notifyUrl = $notifyUrl;
    }

    // ---- Firma ----------------------------------------------------------

    private function derivedKey(string $order): string
    {
        $key = base64_decode($this->key, true);
        if ($key === false) {
            throw new \RuntimeException('REDSYS_MERCHANT_KEY no es base64 válido');
        }
        $len = (int) ceil(strlen($order) / 8) * 8;
        $padded = str_pad($order, max(8, $len), "\0");
        $out = openssl_encrypt($padded, 'des-ede3-cbc', $key, OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING, str_repeat("\0", 8));
        if ($out === false) {
            throw new \RuntimeException('No se pudo derivar la clave de Redsys');
        }
        return $out;
    }

    /** @return array{0:string,1:string} [merchantParameters, signature] */
    private function sign(array $params, string $order): array
    {
        $mp = base64_encode((string) json_encode($params, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $sig = base64_encode(hash_hmac('sha256', $mp, $this->derivedKey($order), true));
        return [$mp, $sig];
    }

    private static function decodeParams(string $mp): array
    {
        $json = base64_decode(strtr($mp, '-_', '+/'), true);
        $p = is_string($json) ? json_decode($json, true) : null;
        return is_array($p) ? $p : [];
    }

    private static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }

    private static function orderCode(): string
    {
        return substr((string) (int) (microtime(true) * 1000), -6) . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    }

    private static function isPaid(string $code): bool
    {
        return $code !== '' && ctype_digit(ltrim($code, '0') === '' ? '0' : ltrim($code, '0')) && (int) $code <= 99;
    }

    private static function now(int $addMonths = 0, int $addDays = 0): string
    {
        $d = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        if ($addMonths) {
            $d = $d->modify("+{$addMonths} month");
        }
        if ($addDays) {
            $d = $d->modify("+{$addDays} day");
        }
        return $d->format('Y-m-d H:i:s.v');
    }

    private function insertPayment(string $userId, string $order, int $amount, string $kind): void
    {
        $this->db->run(
            'INSERT INTO redsys_payments (id, user_id, order_code, amount_cents, currency, kind, status)
             VALUES (:id, :u, :o, :a, "EUR", :k, "pending")',
            ['id' => self::uuid(), 'u' => $userId, 'o' => $order, 'a' => $amount, 'k' => $kind],
        );
    }

    private function formFor(string $order, int $amount, string $origin, string $desc, bool $tokenize): array
    {
        $origin = rtrim($origin, '/');
        $p = [
            'DS_MERCHANT_AMOUNT' => (string) $amount,
            'DS_MERCHANT_ORDER' => $order,
            'DS_MERCHANT_MERCHANTCODE' => $this->code,
            'DS_MERCHANT_CURRENCY' => '978',
            'DS_MERCHANT_TRANSACTIONTYPE' => '0',
            'DS_MERCHANT_TERMINAL' => $this->terminal,
            'DS_MERCHANT_MERCHANTURL' => $this->notifyUrl,
            'DS_MERCHANT_URLOK' => $origin . '/app/billing?redsys=ok',
            'DS_MERCHANT_URLKO' => $origin . '/app/billing?redsys=ko',
            'DS_MERCHANT_CONSUMERLANGUAGE' => '001',
            'DS_MERCHANT_MERCHANTNAME' => $this->name,
            'DS_MERCHANT_PRODUCTDESCRIPTION' => mb_substr($desc, 0, 125),
        ];
        if ($tokenize) {
            $p['DS_MERCHANT_IDENTIFIER'] = 'REQUIRED';
            $p['DS_MERCHANT_COF_INI'] = 'S';
            $p['DS_MERCHANT_COF_TYPE'] = 'R';
        }
        [$mp, $sig] = $this->sign($p, $order);
        return [
            'url' => $this->urlTpv,
            'merchantParameters' => $mp,
            'signature' => $sig,
            'signatureVersion' => 'HMAC_SHA256_V1',
        ];
    }

    private static function origin(array $body): string
    {
        $o = (string) ($body['origin'] ?? '');
        if (!preg_match('#^https?://[^\s/]+$#', rtrim($o, '/'))) {
            Http::fail('Origen no válido', 400, 'bad_origin');
        }
        return $o;
    }

    // ---- Pago inicial (aportación mensual) --------------------------------

    public function checkout(string $userId, array $body): array
    {
        $amount = (int) ($body['amount_cents'] ?? 0);
        if ($amount <= 0) {
            $row = $this->db->one('SELECT subscription_price_cents FROM pricing_config WHERE id = 1');
            $amount = (int) ($row['subscription_price_cents'] ?? 0);
        }
        if ($amount < 100 || $amount > 1000000) {
            Http::fail('Importe no válido', 400, 'bad_amount');
        }
        $order = self::orderCode();
        $this->insertPayment($userId, $order, $amount, 'subscription');
        $desc = trim((string) ($body['description'] ?? '')) ?: 'Xandralyze — Aportación mensual';
        return $this->formFor($order, $amount, self::origin($body), $desc, true);
    }

    // ---- Consumo extra --------------------------------------------------

    public function payExtra(string $userId, array $body): array
    {
        $origin = self::origin($body);
        $b = $this->db->one(
            'SELECT redsys_card_token, redsys_original_auth_code, extra_pending_cents FROM user_billing WHERE user_id = :u',
            ['u' => $userId],
        );
        $amount = (int) round((float) ($b['extra_pending_cents'] ?? 0));
        if ($amount <= 0) {
            return ['mode' => 'none', 'amount' => 0];
        }
        $order = self::orderCode();
        $this->insertPayment($userId, $order, $amount, 'extra');

        if (!empty($b['redsys_card_token']) && !empty($b['redsys_original_auth_code'])) {
            $res = $this->chargeSaved($order, $amount, (string) $b['redsys_card_token'], (string) $b['redsys_original_auth_code'], 'Xandralyze — Consumo extra de IA');
            if ($res['ok']) {
                $this->db->run('UPDATE user_billing SET extra_pending_cents = 0 WHERE user_id = :u', ['u' => $userId]);
            }
            return ['mode' => 'charged', 'amount' => $amount, 'ok' => $res['ok'], 'responseCode' => $res['code']];
        }
        return ['mode' => 'redirect', 'amount' => $amount] + $this->formFor($order, $amount, $origin, 'Xandralyze — Consumo extra de IA', false);
    }

    // ---- Cobro con tarjeta guardada (REST) --------------------------------

    /** @return array{ok:bool, code:string} */
    private function chargeSaved(string $order, int $amount, string $token, string $txnId, string $desc): array
    {
        $p = [
            'DS_MERCHANT_AMOUNT' => (string) $amount,
            'DS_MERCHANT_ORDER' => $order,
            'DS_MERCHANT_MERCHANTCODE' => $this->code,
            'DS_MERCHANT_CURRENCY' => '978',
            'DS_MERCHANT_TRANSACTIONTYPE' => '0',
            'DS_MERCHANT_TERMINAL' => $this->terminal,
            'DS_MERCHANT_IDENTIFIER' => $token,
            'DS_MERCHANT_DIRECTPAYMENT' => 'true',
            'DS_MERCHANT_COF_INI' => 'N',
            'DS_MERCHANT_COF_TYPE' => 'R',
            'DS_MERCHANT_COF_TXNID' => $txnId,
            'DS_MERCHANT_PRODUCTDESCRIPTION' => $desc,
        ];
        [$mp, $sig] = $this->sign($p, $order);
        $ch = curl_init($this->urlRest);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'Ds_SignatureVersion' => 'HMAC_SHA256_V1',
                'Ds_MerchantParameters' => $mp,
                'Ds_Signature' => $sig,
            ]),
        ]);
        $text = curl_exec($ch);
        curl_close($ch);
        $json = is_string($text) ? json_decode($text, true) : null;
        $out = is_array($json) && isset($json['Ds_MerchantParameters'])
            ? self::decodeParams((string) $json['Ds_MerchantParameters'])
            : (is_array($json) ? $json : ['body' => (string) $text]);
        $code = (string) ($out['Ds_Response'] ?? $out['DS_RESPONSE'] ?? ($out['errorCode'] ?? 'NO_RESPONSE'));
        $ok = self::isPaid($code);
        $this->db->run(
            'UPDATE redsys_payments SET status = :s, response_code = :c, auth_code = :a, raw_response = :r WHERE order_code = :o',
            [
                's' => $ok ? 'paid' : 'failed',
                'c' => mb_substr($code, 0, 20),
                'a' => $out['Ds_AuthorisationCode'] ?? null,
                'r' => json_encode($out),
                'o' => $order,
            ],
        );
        return ['ok' => $ok, 'code' => $code];
    }

    // ---- Notificación de Redsys -------------------------------------------

    public function notification(): void
    {
        $mp = (string) ($_POST['Ds_MerchantParameters'] ?? '');
        $sig = (string) ($_POST['Ds_Signature'] ?? '');
        if ($mp === '' || $sig === '') {
            $j = json_decode((string) file_get_contents('php://input'), true);
            $mp = (string) ($j['Ds_MerchantParameters'] ?? '');
            $sig = (string) ($j['Ds_Signature'] ?? '');
        }
        if ($mp === '' || $sig === '') {
            http_response_code(400);
            exit('Missing params');
        }
        $p = self::decodeParams($mp);
        $order = (string) ($p['Ds_Order'] ?? $p['DS_ORDER'] ?? '');
        if ($order === '') {
            http_response_code(400);
            exit('Missing order');
        }
        $calc = base64_encode(hash_hmac('sha256', $mp, $this->derivedKey($order), true));
        if (!hash_equals(strtr($calc, '+/', '-_'), strtr(trim($sig), '+/', '-_'))) {
            error_log('[redsys] firma no válida para ' . $order);
            http_response_code(401);
            exit('Invalid signature');
        }

        $code = (string) ($p['Ds_Response'] ?? '');
        $paid = self::isPaid($code);
        $auth = $p['Ds_AuthorisationCode'] ?? null;
        $token = $p['Ds_Merchant_Identifier'] ?? null;
        $brand = $p['Ds_Card_Brand'] ?? null;
        $expiry = $p['Ds_ExpiryDate'] ?? null;

        $pay = $this->db->one('SELECT user_id, kind, amount_cents, status FROM redsys_payments WHERE order_code = :o', ['o' => $order]);
        if ($pay === null) {
            error_log('[redsys] pedido desconocido ' . $order);
            exit('OK');
        }
        $alreadyPaid = $pay['status'] === 'paid';
        $this->db->run(
            'UPDATE redsys_payments SET status = :s, response_code = :c, auth_code = :a, card_token = :t,
             card_brand = :b, card_expiry = :e, raw_response = :r WHERE order_code = :o',
            ['s' => $paid ? 'paid' : 'failed', 'c' => $code, 'a' => $auth, 't' => $token, 'b' => $brand, 'e' => $expiry, 'r' => json_encode($p), 'o' => $order],
        );
        if (!$paid || $alreadyPaid) {
            exit('OK');
        }

        $uid = (string) $pay['user_id'];
        if (in_array($pay['kind'], ['subscription', 'renewal'], true)) {
            $prev = $this->db->one('SELECT donation_to_credits, credit_balance_cents FROM user_billing WHERE user_id = :u', ['u' => $uid]);
            $toCredits = $prev === null ? true : (bool) $prev['donation_to_credits'];
            $credit = (float) ($prev['credit_balance_cents'] ?? 0) + ($toCredits ? (float) $pay['amount_cents'] : 0);
            $this->db->run(
                'INSERT INTO user_billing (user_id, subscription_status, current_period_start, current_period_end, next_charge_at,
                   included_used_cents, credit_balance_cents, redsys_card_token, redsys_card_brand, redsys_card_expiry,
                   redsys_original_auth_code, redsys_original_order)
                 VALUES (:u, "active", :s, :e, :e2, 0, :c, :t, :b, :x, :a, :o)
                 ON DUPLICATE KEY UPDATE subscription_status = "active", current_period_start = VALUES(current_period_start),
                   current_period_end = VALUES(current_period_end), next_charge_at = VALUES(next_charge_at),
                   included_used_cents = 0, credit_balance_cents = VALUES(credit_balance_cents),
                   redsys_card_token = VALUES(redsys_card_token), redsys_card_brand = VALUES(redsys_card_brand),
                   redsys_card_expiry = VALUES(redsys_card_expiry), redsys_original_auth_code = VALUES(redsys_original_auth_code),
                   redsys_original_order = VALUES(redsys_original_order)',
                ['u' => $uid, 's' => self::now(), 'e' => self::now(1), 'e2' => self::now(1), 'c' => $credit, 't' => $token, 'b' => $brand, 'x' => $expiry, 'a' => $auth, 'o' => $order],
            );
        } elseif ($pay['kind'] === 'extra') {
            $this->db->run('UPDATE user_billing SET extra_pending_cents = 0 WHERE user_id = :u', ['u' => $uid]);
        }
        exit('OK');
    }

    // ---- Renovaciones mensuales (tarea programada diaria) -----------------

    public function chargeRecurring(): array
    {
        $row = $this->db->one('SELECT subscription_price_cents FROM pricing_config WHERE id = 1');
        $amount = (int) ($row['subscription_price_cents'] ?? 0);
        if ($amount <= 0) {
            return ['charged' => 0, 'failed' => 0, 'evaluated' => 0, 'reason' => 'no_price'];
        }
        $due = $this->db->all(
            'SELECT user_id, redsys_card_token, redsys_original_auth_code FROM user_billing
             WHERE subscription_status = "active" AND redsys_card_token IS NOT NULL
               AND next_charge_at <= UTC_TIMESTAMP(3) LIMIT 200',
        );
        $charged = 0;
        $failed = 0;
        foreach ($due as $b) {
            if (empty($b['redsys_original_auth_code'])) {
                continue;
            }
            $uid = (string) $b['user_id'];
            $order = self::orderCode();
            $this->insertPayment($uid, $order, $amount, 'renewal');
            $res = $this->chargeSaved($order, $amount, (string) $b['redsys_card_token'], (string) $b['redsys_original_auth_code'], 'Xandralyze — Renovación mensual');
            if ($res['ok']) {
                $this->db->run(
                    'UPDATE user_billing SET current_period_start = :s, current_period_end = :e, next_charge_at = :e2,
                     included_used_cents = 0,
                     credit_balance_cents = credit_balance_cents + IF(donation_to_credits = 1, :a, 0)
                     WHERE user_id = :u',
                    ['s' => self::now(), 'e' => self::now(1), 'e2' => self::now(1), 'a' => $amount, 'u' => $uid],
                );
                $charged++;
            } else {
                $this->db->run(
                    'UPDATE user_billing SET subscription_status = "past_due", next_charge_at = :n WHERE user_id = :u',
                    ['n' => self::now(0, 1), 'u' => $uid],
                );
                $failed++;
            }
        }
        return ['charged' => $charged, 'failed' => $failed, 'evaluated' => count($due)];
    }
}
