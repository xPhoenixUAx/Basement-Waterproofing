<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
// PHP 8.1+. One same-origin endpoint; no browser-supplied mail recipient.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit();
}
try {
    $raw = file_get_contents(__DIR__ . '/../config/config.js');
    if (
        $raw === false ||
        !preg_match('/window\.SITE_CONFIG\s*=\s*(\{.*\})\s*;\s*\z/s', $raw, $match)
    ) {
        throw new RuntimeException('Config');
    }
    $config = json_decode($match[1], true, 32, JSON_THROW_ON_ERROR);
    $siteUrl = getenv('APP_ORIGIN') ?: (string) $config['brand']['siteUrl'];
    $url = parse_url($siteUrl);
    if (
        !$url ||
        !in_array($url['scheme'] ?? '', ['http', 'https'], true) ||
        empty($url['host']) ||
        isset($url['user']) || isset($url['pass']) ||
        preg_match('/[\s\x00-\x1F\x7F]/', $siteUrl)
    ) {
        throw new RuntimeException('Origin');
    }
    $scheme = $url['scheme'];
    $port = $url['port'] ?? ($scheme === 'https' ? 443 : 80);
    $defaultPort = $scheme === 'https' ? 443 : 80;
    $origin = $scheme . '://' . strtolower($url['host']) .
        ($port === $defaultPort ? '' : ':' . $port);
    session_name('belowline_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => str_starts_with($origin, 'https://'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if (!session_start()) {
        throw new RuntimeException('Session');
    }
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method === 'GET') {
        reply(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        reply(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 20000) {
        reply(413, ['ok' => false, 'message' => 'Request too large.']);
    }
    if (
        (!empty($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] !== $origin) ||
        ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site'
    ) {
        reply(403, ['ok' => false, 'message' => 'Please open the form on our website.']);
    }
    $p = $_POST;
    foreach ($p as $v) {
        if (!is_string($v)) {
            reply(422, ['ok' => false, 'message' => 'Invalid form data.']);
        }
    }
    if (!isset($p['csrf']) || !hash_equals($_SESSION['csrf'], $p['csrf'])) {
        reply(403, ['ok' => false, 'message' => 'Your form session expired. Please try again.']);
    }
    if (!empty($p['website'])) {
        reply(422, ['ok' => false, 'message' => 'Please leave the website field empty.']);
    }
    $requestId = $p['requestId'] ?? '';
    if (!preg_match('/^[A-Za-z0-9-]{16,64}$/', $requestId)) {
        reply(422, ['ok' => false, 'message' => 'Please reload the form.']);
    }
    $fingerprintData = $p;
    unset($fingerprintData['csrf']);
    ksort($fingerprintData);
    $fingerprint = hash('sha256', json_encode($fingerprintData, JSON_THROW_ON_ERROR));
    $_SESSION['sent'] ??= [];
    foreach ($_SESSION['sent'] as $key => $entry) {
        if ($entry['time'] < time() - 3600) {
            unset($_SESSION['sent'][$key]);
        }
    }
    // Session lock serializes same-session retries, including a timed-out first request.
    if (isset($_SESSION['sent'][$requestId])) {
        if (!hash_equals($_SESSION['sent'][$requestId]['hash'], $fingerprint)) {
            reply(409, [
                'ok' => false,
                'message' => 'This request was already received. Reload to start a new request.',
            ]);
        }
        reply(200, ['ok' => true, 'requestId' => $requestId]);
    }
    $dir = sys_get_temp_dir() . '/belowline-' . substr(hash('sha256', __DIR__), 0, 16);
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Rate directory');
    }
    $key = hash_hmac(
        'sha256',
        $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        getenv('RATE_LIMIT_SECRET') ?: __DIR__,
    );
    $handle = fopen($dir . '/' . $key . '.json', 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        throw new RuntimeException('Rate lock');
    }
    $counter = json_decode(stream_get_contents($handle) ?: '{}', true) ?: [];
    if (($counter['reset'] ?? 0) < time()) {
        $counter = ['count' => 0, 'reset' => time() + 600];
    }
    if ($counter['count'] >= 5) {
        flock($handle, LOCK_UN);
        fclose($handle);
        header('Retry-After: ' . max(1, $counter['reset'] - time()));
        reply(429, ['ok' => false, 'message' => 'Too many attempts. Please wait a few minutes.']);
    }
    $counter['count']++;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($counter));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    if (random_int(1, 30) === 1) {
        $n = 0;
        foreach (new DirectoryIterator($dir) as $file) {
            if ($n++ > 100) {
                break;
            }
            if ($file->isFile() && $file->getMTime() < time() - 86400) {
                @unlink($file->getPathname());
            }
        }
    }
    $errors = [];
    $clean = [];
    $field = function (string $name, int $min, int $max) use ($p, &$errors, &$clean): string {
        $v = trim($p[$name] ?? '');
        $length = preg_match_all('/./us', $v, $unused);
        if (
            $length === false ||
            $length < $min ||
            $length > $max ||
            preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $v)
        ) {
            $errors[$name] = 'Please check this field.';
        }
        return $clean[$name] = $v;
    };
    $zip = $field('zip', 5, 5);
    if (!preg_match('/^[0-9]{5}$/', $zip)) {
        $errors['zip'] = 'Enter a 5-digit ZIP code.';
    }
    $service = $field('service', 6, 40);
    if (
        !in_array(
            $service,
            [
                'interior-waterproofing',
                'exterior-waterproofing',
                'sump-pump-systems',
                'foundation-crack-sealing',
                'unsure',
            ],
            true,
        )
    ) {
        $errors['service'] = 'Choose a service.';
    }
    $field('name', 2, 100);
    $email = $field('email', 3, 254);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    $field('details', 10, 2000);
    $zone = $field('locationDetail', 4, 6);
    if (!in_array($zone, ['walls', 'floor', 'sump', 'unsure'], true)) {
        $errors['locationDetail'] = 'Invalid location.';
    }
    if (($p['privacy'] ?? '') !== '1') {
        $errors['privacy'] = 'Please acknowledge the privacy notice.';
    }
    if ($errors) {
        reply(422, [
            'ok' => false,
            'message' => 'Please review the highlighted fields.',
            'errors' => $errors,
        ]);
    }
    $to = (string) $config['form']['recipientEmail'];
    $from = (string) $config['form']['senderEmail'];
    $brand = (string) $config['brand']['name'];
    $sender = str_replace('{brand}', $brand, (string) ($config['form']['senderName'] ?? '{brand}'));
    $subject = str_replace(
        '{brand}',
        $brand,
        (string) ($config['form']['subject'] ?? '{brand} — Basement waterproofing request'),
    );
    foreach ([$to, $from] as $address) {
        if (
            !filter_var($address, FILTER_VALIDATE_EMAIL) ||
            preg_match('/[\r\n]/', $address) ||
            preg_match('/@example\.(com|org|net)$/i', $address)
        ) {
            throw new RuntimeException('Configure mail');
        }
    }
    if ($sender === '' || strlen($sender) > 150 || preg_match('/[\r\n]/', $sender)) {
        throw new RuntimeException('Sender name');
    }
    if ($subject === '' || strlen($subject) > 300 || preg_match('/[\r\n]/', $subject)) {
        throw new RuntimeException('Subject');
    }
    $body = "Request ID: $requestId\r\n";
    foreach ($clean as $name => $value) {
        $body .= $name . ': ' . str_replace(["\r\n", "\r"], "\n", $value) . "\r\n";
    }
    $body .=
        "Privacy acknowledgement: yes\r\nNotice date: " .
        ($config['legal']['updated'] ?? '') .
        "\r\nReceived UTC: " .
        gmdate('c') .
        "\r\n";
    $headers = [
        'From' => '=?UTF-8?B?' . base64_encode($sender) . '?= <' . $from . '>',
        'Reply-To' => $email,
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => 'quoted-printable',
    ];
    if (
        !mail(
            $to,
            '=?UTF-8?B?' . base64_encode($subject) . '?=',
            quoted_printable_encode($body),
            $headers,
        )
    ) {
        throw new RuntimeException('Transport');
    }
    $_SESSION['sent'][$requestId] = ['hash' => $fingerprint, 'time' => time()];
    if (count($_SESSION['sent']) > 20) {
        array_shift($_SESSION['sent']);
    }
    reply(200, ['ok' => true, 'requestId' => $requestId]);
} catch (Throwable $e) {
    error_log('Belowline form error: ' . get_class($e));
    reply(503, [
        'ok' => false,
        'message' => 'We could not send your request. Please try again later.',
    ]);
}
