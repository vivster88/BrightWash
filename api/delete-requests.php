<?php
// BrightWash POS - Delete Requests API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM delete_requests ORDER BY created_at DESC LIMIT 50");
        $rows = $stmt->fetchAll();
        $requests = array_map(function($r) {
            return [
                'id' => $r['id'],
                'orderId' => $r['order_id'],
                'customerName' => $r['customer_name'],
                'serviceType' => $r['service_type'],
                'amount' => (float)$r['amount'],
                'reason' => $r['reason'],
                'requestedBy' => $r['requested_by'],
                'requestedAt' => $r['requested_at'],
                'status' => $r['status'],
                'approvedAt' => $r['approved_at'],
                'deniedAt' => $r['denied_at'],
            ];
        }, $rows);
        respond(['success' => true, 'data' => $requests]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['id'])) respond(['error' => 'id required'], 400);
        $stmt = $db->prepare("INSERT INTO delete_requests (id, order_id, customer_name, service_type, amount, reason, requested_by, requested_at, status) VALUES (?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE status=VALUES(status), approved_at=VALUES(approved_at), denied_at=VALUES(denied_at)");
        $stmt->execute([
            $body['id'],
            $body['orderId'] ?? '',
            $body['customerName'] ?? '',
            $body['serviceType'] ?? '',
            $body['amount'] ?? 0,
            $body['reason'] ?? '',
            $body['requestedBy'] ?? 'staff',
            $body['requestedAt'] ?? date('c'),
            $body['status'] ?? 'pending',
        ]);
        respond(['success' => true]);
        break;

    case 'PUT':
        $body = getBody();
        if (empty($body['id'])) respond(['error' => 'id required'], 400);
        $stmt = $db->prepare("UPDATE delete_requests SET status=?, approved_at=?, denied_at=? WHERE id=?");
        $stmt->execute([
            $body['status'] ?? 'pending',
            $body['approvedAt'] ?? null,
            $body['deniedAt'] ?? null,
            $body['id'],
        ]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
