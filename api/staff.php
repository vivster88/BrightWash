<?php
// BrightWash POS - Staff API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT username, password, name, created_at FROM staff ORDER BY created_at DESC");
        $rows = $stmt->fetchAll();
        $staff = array_map(function($r) {
            return ['username' => $r['username'], 'password' => $r['password'], 'name' => $r['name'], 'created' => $r['created_at']];
        }, $rows);
        respond(['success' => true, 'data' => $staff]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['username']) || empty($body['password']) || empty($body['name'])) {
            respond(['error' => 'username, password, and name required'], 400);
        }
        $stmt = $db->prepare("INSERT INTO staff (username, password, name) VALUES (?,?,?)
            ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name)");
        $stmt->execute([$body['username'], $body['password'], $body['name']]);
        respond(['success' => true]);
        break;

    case 'DELETE':
        $username = $_GET['username'] ?? '';
        if (!$username) respond(['error' => 'username required'], 400);
        $db->prepare("DELETE FROM staff WHERE username=?")->execute([$username]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
