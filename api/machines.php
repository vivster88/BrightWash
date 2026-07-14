<?php
// BrightWash POS - Machines API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM machines ORDER BY id");
        $rows = $stmt->fetchAll();
        $machines = array_map(function($r) {
            return [
                'id' => (int)$r['id'],
                'name' => $r['name'],
                'maintenance' => (bool)$r['maintenance'],
                'wash' => ['status' => $r['wash_status'], 'orderId' => $r['wash_order_id'], 'customer' => $r['wash_customer'], 'start' => $r['wash_start'], 'duration' => (int)$r['wash_duration'], 'end' => $r['wash_end']],
                'dry' => ['status' => $r['dry_status'], 'orderId' => $r['dry_order_id'], 'customer' => $r['dry_customer'], 'start' => $r['dry_start'], 'duration' => (int)$r['dry_duration'], 'end' => $r['dry_end']],
            ];
        }, $rows);
        respond(['success' => true, 'data' => $machines]);
        break;

    case 'PUT':
        $body = getBody();
        if (!isset($body['id'])) respond(['error' => 'id required'], 400);
        $stmt = $db->prepare("UPDATE machines SET wash_status=?, wash_order_id=?, wash_customer=?, wash_start=?, wash_duration=?, wash_end=?, dry_status=?, dry_order_id=?, dry_customer=?, dry_start=?, dry_duration=?, dry_end=?, maintenance=? WHERE id=?");
        $w = $body['wash'] ?? [];
        $d = $body['dry'] ?? [];
        $stmt->execute([
            $w['status'] ?? 'IDLE', $w['orderId'] ?? null, $w['customer'] ?? null, $w['start'] ?? null, $w['duration'] ?? 30, $w['end'] ?? null,
            $d['status'] ?? 'IDLE', $d['orderId'] ?? null, $d['customer'] ?? null, $d['start'] ?? null, $d['duration'] ?? 40, $d['end'] ?? null,
            $body['maintenance'] ? 1 : 0,
            $body['id'],
        ]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
