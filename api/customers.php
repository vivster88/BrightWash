<?php
// BrightWash POS - Customers API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM customers ORDER BY created_at DESC");
        $rows = $stmt->fetchAll();
        $customers = array_map(function($r) {
            return [
                'id' => $r['id'],
                'name' => $r['name'],
                'phone' => $r['phone'],
                'level' => (int)$r['level'],
                'xp' => (int)$r['xp'],
                'points' => (int)$r['points'],
                'achievements' => json_decode($r['achievements'], true) ?: [],
                'totalOrders' => (int)$r['total_orders'],
                'joined' => $r['joined_date'],
            ];
        }, $rows);
        respond(['success' => true, 'data' => $customers]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['id']) || empty($body['name'])) {
            respond(['error' => 'id and name required'], 400);
        }
        $stmt = $db->prepare("INSERT INTO customers (id, name, phone, level, xp, points, achievements, total_orders, joined_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), level=VALUES(level), xp=VALUES(xp), points=VALUES(points), achievements=VALUES(achievements), total_orders=VALUES(total_orders)");
        $stmt->execute([
            $body['id'],
            $body['name'],
            $body['phone'] ?? '',
            $body['level'] ?? 1,
            $body['xp'] ?? 0,
            $body['points'] ?? 0,
            json_encode($body['achievements'] ?? []),
            $body['totalOrders'] ?? 0,
            $body['joined'] ?? date('Y-m-d'),
        ]);
        respond(['success' => true]);
        break;

    case 'PUT':
        $body = getBody();
        if (empty($body['id'])) respond(['error' => 'id required'], 400);
        $stmt = $db->prepare("UPDATE customers SET name=?, phone=?, level=?, xp=?, points=?, achievements=?, total_orders=? WHERE id=?");
        $stmt->execute([
            $body['name'] ?? '',
            $body['phone'] ?? '',
            $body['level'] ?? 1,
            $body['xp'] ?? 0,
            $body['points'] ?? 0,
            json_encode($body['achievements'] ?? []),
            $body['totalOrders'] ?? 0,
            $body['id'],
        ]);
        respond(['success' => true]);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? '';
        if (!$id) respond(['error' => 'id required'], 400);
        $db->prepare("DELETE FROM customers WHERE id=?")->execute([$id]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
