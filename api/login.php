<?php
// BrightWash POS - Login API
require_once __DIR__ . '/config.php';
$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'POST only'], 405);
}

$body = getBody();
$username = strtolower(trim($body['username'] ?? ''));
$password = $body['password'] ?? '';

// Admin check
if ($username === 'admin' && $password === 'Sh@rik@zuniga') {
    respond(['success' => true, 'role' => 'admin']);
}

// Default staff check
if ($username === 'brightwashstaff' && $password === 'brightwash') {
    respond(['success' => true, 'role' => 'staff', 'name' => 'Default Staff']);
}

// Custom staff from database
$stmt = $db->prepare("SELECT username, password, name FROM staff WHERE username = ?");
$stmt->execute([$username]);
$staff = $stmt->fetch();

if ($staff && $staff['password'] === $password) {
    respond(['success' => true, 'role' => 'staff', 'name' => $staff['name']]);
}

respond(['success' => false, 'error' => 'Invalid username or password'], 401);
