<?php
// BrightWash POS - Database Configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'u705579402_brightwashdb');
define('DB_USER', 'u705579402_brightwashdb');
define('DB_PASS', 'Br!ghtw@shdb8');

// CORS headers for API access
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database connection
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

// Helper: get JSON body
function getBody() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

// Helper: respond JSON
function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}
