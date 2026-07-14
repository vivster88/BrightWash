<?php
// BrightWash POS - Orders API
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM orders ORDER BY created_at DESC");
        $rows = $stmt->fetchAll();
        $orders = array_map(function($r) {
            return [
                'id' => $r['id'],
                'customerId' => $r['customer_id'],
                'customerName' => $r['customer_name'],
                'serviceType' => $r['service_type'],
                'selectedServices' => json_decode($r['selected_services'], true) ?: [],
                'items' => json_decode($r['items'], true) ?: [],
                'consumables' => json_decode($r['consumables'], true) ?: [],
                'weightKg' => (float)$r['weight_kg'],
                'isExpress' => (bool)$r['is_express'],
                'totalCost' => (float)$r['total_cost'],
                'xpEarned' => (int)$r['xp_earned'],
                'pointsEarned' => (int)$r['points_earned'],
                'staffCommission' => (float)$r['staff_commission'],
                'status' => $r['status'],
                'payment' => $r['payment'],
                'paymentProof' => $r['payment_proof'],
                'proofDeleted' => (bool)$r['proof_deleted'],
                'washMachine' => $r['wash_machine'],
                'dryMachine' => $r['dry_machine'],
                'washStart' => $r['wash_start'],
                'dryStart' => $r['dry_start'],
                'readyAt' => $r['ready_at'],
                'completedAt' => $r['completed_at'],
                'transitions' => json_decode($r['transitions'], true) ?: [],
                'createdAt' => $r['created_at'],
            ];
        }, $rows);
        respond(['success' => true, 'data' => $orders]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['id'])) respond(['error' => 'id required'], 400);
        $stmt = $db->prepare("INSERT INTO orders (id, customer_id, customer_name, service_type, selected_services, items, consumables, weight_kg, is_express, total_cost, xp_earned, points_earned, staff_commission, status, payment, payment_proof, transitions) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status=VALUES(status), payment_proof=VALUES(payment_proof), transitions=VALUES(transitions), wash_machine=VALUES(wash_machine), dry_machine=VALUES(dry_machine), staff_commission=VALUES(staff_commission)");
        $stmt->execute([
            $body['id'],
            $body['customerId'] ?? '',
            $body['customerName'] ?? '',
            $body['serviceType'] ?? '',
            json_encode($body['selectedServices'] ?? []),
            json_encode($body['items'] ?? []),
            json_encode($body['consumables'] ?? []),
            $body['weightKg'] ?? 0,
            $body['isExpress'] ? 1 : 0,
            $body['totalCost'] ?? 0,
            $body['xpEarned'] ?? 0,
            $body['pointsEarned'] ?? 0,
            $body['staffCommission'] ?? 0,
            $body['status'] ?? 'PENDING',
            $body['payment'] ?? 'CASH',
            $body['paymentProof'] ?? null,
            json_encode($body['transitions'] ?? []),
        ]);
        respond(['success' => true]);
        break;

    case 'PUT':
        $body = getBody();
        if (empty($body['id'])) respond(['error' => 'id required'], 400);
        
        // Build dynamic update
        $fields = [];
        $values = [];
        $map = [
            'status' => 'status', 'washMachine' => 'wash_machine', 'dryMachine' => 'dry_machine',
            'washStart' => 'wash_start', 'dryStart' => 'dry_start', 'readyAt' => 'ready_at',
            'completedAt' => 'completed_at', 'paymentProof' => 'payment_proof', 'proofDeleted' => 'proof_deleted',
        ];
        foreach ($map as $js => $col) {
            if (array_key_exists($js, $body)) {
                $fields[] = "$col = ?";
                $values[] = is_bool($body[$js]) ? ($body[$js] ? 1 : 0) : $body[$js];
            }
        }
        if (isset($body['transitions'])) {
            $fields[] = "transitions = ?";
            $values[] = json_encode($body['transitions']);
        }
        if (empty($fields)) respond(['error' => 'No fields to update'], 400);
        
        $values[] = $body['id'];
        $sql = "UPDATE orders SET " . implode(', ', $fields) . " WHERE id = ?";
        $db->prepare($sql)->execute($values);
        respond(['success' => true]);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? '';
        if (!$id) respond(['error' => 'id required'], 400);
        $db->prepare("DELETE FROM orders WHERE id=?")->execute([$id]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
