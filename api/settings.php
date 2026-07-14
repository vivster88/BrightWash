<?php
// BrightWash POS - Settings API (rewards config, etc)
require_once __DIR__ . '/config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->query("SELECT * FROM settings");
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['setting_key']] = json_decode($r['setting_value'], true);
        }
        respond(['success' => true, 'data' => $settings]);
        break;

    case 'POST':
        $body = getBody();
        if (empty($body['key'])) respond(['error' => 'key required'], 400);
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?,?)
            ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)");
        $stmt->execute([$body['key'], json_encode($body['value'])]);
        respond(['success' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
