<?php
// BrightWash POS - Shifts API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM shifts ORDER BY created_at DESC LIMIT 50");
        $rows = $stmt->fetchAll();
        $shifts = array_map(function($r) {
            return [
                'id' => $r['id'],
                'staffName' => $r['staff_name'],
                'role' => $r['role'],
                'clockIn' => $r['clock_in'],
                'clockOut' => $r['clock_out'],
                'stats' => json_decode($r['stats'], true),
            ];
        }, $rows);
        respond(['success' => true, 'data' => $shifts]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['id'])) respond(['error' => 'id required'], 400);
        $stmt = $db->prepare("INSERT INTO shifts (id, staff_name, role, clock_in, clock_out, stats) VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE clock_out=VALUES(clock_out), stats=VALUES(stats)");
        $stmt->execute([
            $body['id'],
            $body['staffName'] ?? '',
            $body['role'] ?? 'staff',
            $body['clockIn'] ?? '',
            $body['clockOut'] ?? null,
            json_encode($body['stats'] ?? null),
        ]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
