<?php
// BrightWash POS - Services API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM services ORDER BY service_key");
        $rows = $stmt->fetchAll();
        $services = [];
        foreach ($rows as $r) {
            $services[$r['service_key']] = [
                'name' => $r['name'],
                'rate' => (float)$r['rate'],
                'unit' => $r['unit'],
                'icon' => $r['icon'],
                'duration' => (int)$r['duration'],
                'staffCommission' => (float)($r['staff_commission'] ?? 0),
            ];
        }
        respond(['success' => true, 'data' => $services]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['key']) || empty($body['name'])) respond(['error' => 'key and name required'], 400);
        $stmt = $db->prepare("INSERT INTO services (service_key, name, rate, unit, icon, duration, staff_commission) VALUES (?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE name=VALUES(name), rate=VALUES(rate), unit=VALUES(unit), icon=VALUES(icon), duration=VALUES(duration), staff_commission=VALUES(staff_commission)");
        $stmt->execute([
            $body['key'],
            $body['name'],
            $body['rate'] ?? 0,
            $body['unit'] ?? 'load',
            $body['icon'] ?? '🧺',
            $body['duration'] ?? 30,
            $body['staffCommission'] ?? 0,
        ]);
        respond(['success' => true]);
        break;

    case 'DELETE':
        $key = $_GET['key'] ?? '';
        if (!$key) respond(['error' => 'key required'], 400);
        $db->prepare("DELETE FROM services WHERE service_key=?")->execute([$key]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
