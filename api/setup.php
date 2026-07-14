<?php
// BrightWash POS - Database Setup (run once to create tables)
require_once __DIR__ . '/config.php';

$db = getDB();

// Handle reset request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['reset'])) {
    $what = $_GET['reset'];
    if ($what === 'orders') {
        $db->exec("DELETE FROM orders");
        $db->exec("DELETE FROM deleted_log");
        $db->exec("DELETE FROM delete_requests");
        $db->exec("DELETE FROM shifts");
        // Reset machines to idle
        $db->exec("UPDATE machines SET wash_status='IDLE', wash_order_id=NULL, wash_customer=NULL, wash_start=NULL, wash_end=NULL, dry_status='IDLE', dry_order_id=NULL, dry_customer=NULL, dry_start=NULL, dry_end=NULL");
        // Reset customer stats
        $db->exec("UPDATE customers SET level=1, xp=0, points=0, achievements='[]', total_orders=0");
        respond(['success' => true, 'message' => 'All transactions, shifts, and customer stats reset']);
    }
    respond(['error' => 'Unknown reset target'], 400);
}

$queries = [
    // Customers table
    "CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        level INT DEFAULT 1,
        xp INT DEFAULT 0,
        points INT DEFAULT 0,
        achievements TEXT DEFAULT '[]',
        total_orders INT DEFAULT 0,
        joined_date VARCHAR(20) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Orders table
    "CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50),
        customer_name VARCHAR(255),
        service_type VARCHAR(50),
        selected_services TEXT DEFAULT '[]',
        items TEXT DEFAULT '[]',
        consumables TEXT DEFAULT '[]',
        weight_kg DECIMAL(5,2) DEFAULT 0,
        is_express TINYINT(1) DEFAULT 0,
        total_cost DECIMAL(10,2) DEFAULT 0,
        xp_earned INT DEFAULT 0,
        points_earned INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'PENDING',
        payment VARCHAR(20) DEFAULT 'CASH',
        payment_proof LONGTEXT DEFAULT NULL,
        proof_deleted TINYINT(1) DEFAULT 0,
        wash_machine VARCHAR(50) DEFAULT '',
        dry_machine VARCHAR(50) DEFAULT '',
        wash_start VARCHAR(50) DEFAULT '',
        dry_start VARCHAR(50) DEFAULT '',
        ready_at VARCHAR(50) DEFAULT '',
        completed_at VARCHAR(50) DEFAULT '',
        transitions TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Services table
    "CREATE TABLE IF NOT EXISTS services (
        service_key VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rate DECIMAL(10,2) DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'load',
        icon VARCHAR(10) DEFAULT '',
        duration INT DEFAULT 30,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Staff accounts table
    "CREATE TABLE IF NOT EXISTS staff (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Shifts table
    "CREATE TABLE IF NOT EXISTS shifts (
        id VARCHAR(50) PRIMARY KEY,
        staff_name VARCHAR(255),
        role VARCHAR(20),
        clock_in VARCHAR(50),
        clock_out VARCHAR(50) DEFAULT NULL,
        stats TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Delete requests table
    "CREATE TABLE IF NOT EXISTS delete_requests (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50),
        customer_name VARCHAR(255),
        service_type VARCHAR(50),
        amount DECIMAL(10,2) DEFAULT 0,
        reason TEXT,
        requested_by VARCHAR(20),
        requested_at VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        approved_at VARCHAR(50) DEFAULT NULL,
        denied_at VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Deleted orders log
    "CREATE TABLE IF NOT EXISTS deleted_log (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50),
        customer_name VARCHAR(255),
        service_type VARCHAR(50),
        amount DECIMAL(10,2) DEFAULT 0,
        deleted_by VARCHAR(20),
        reason TEXT DEFAULT '',
        deleted_at VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Settings (key-value store for rewards config etc)
    "CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // Machines state
    "CREATE TABLE IF NOT EXISTS machines (
        id INT PRIMARY KEY,
        name VARCHAR(50),
        wash_status VARCHAR(20) DEFAULT 'IDLE',
        wash_order_id VARCHAR(50) DEFAULT NULL,
        wash_customer VARCHAR(255) DEFAULT NULL,
        wash_start VARCHAR(50) DEFAULT NULL,
        wash_duration INT DEFAULT 30,
        wash_end VARCHAR(50) DEFAULT NULL,
        dry_status VARCHAR(20) DEFAULT 'IDLE',
        dry_order_id VARCHAR(50) DEFAULT NULL,
        dry_customer VARCHAR(255) DEFAULT NULL,
        dry_start VARCHAR(50) DEFAULT NULL,
        dry_duration INT DEFAULT 40,
        dry_end VARCHAR(50) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

$results = [];
foreach ($queries as $sql) {
    try {
        $db->exec($sql);
        $results[] = ['status' => 'ok', 'sql' => substr($sql, 0, 60) . '...'];
    } catch (PDOException $e) {
        $results[] = ['status' => 'error', 'message' => $e->getMessage(), 'sql' => substr($sql, 0, 60) . '...'];
    }
}

// Insert default machines if empty
$count = $db->query("SELECT COUNT(*) FROM machines")->fetchColumn();
if ($count == 0) {
    for ($i = 1; $i <= 5; $i++) {
        $db->prepare("INSERT INTO machines (id, name) VALUES (?, ?)")->execute([$i, "BrightWash-M$i"]);
    }
    $results[] = ['status' => 'ok', 'message' => 'Inserted 5 default machines'];
}

// Insert default services if empty
$svcCount = $db->query("SELECT COUNT(*) FROM services")->fetchColumn();
if ($svcCount == 0) {
    $defaults = [
        ['WASH', 'Wash', 70, 'load', '🫧', 38],
        ['DRY', 'Dry', 80, 'load', '🌬️', 40],
        ['FOLD', 'Fold', 30, 'load', '👕', 5],
        ['FULL_SERVICE', 'Full Service (Wash+Dry+Fold)', 180, 'load', '⭐', 83],
        ['EXTRA_DRY', 'Extra Dry', 20, 'load', '⏱️', 10],
        ['SPIN_DRY', 'Spin Dry', 15, 'load', '🔄', 5],
    ];
    $stmt = $db->prepare("INSERT INTO services (service_key, name, rate, unit, icon, duration) VALUES (?,?,?,?,?,?)");
    foreach ($defaults as $s) {
        $stmt->execute($s);
    }
    $results[] = ['status' => 'ok', 'message' => 'Inserted default services'];
}

// Insert default rewards settings if empty
$settingsCount = $db->query("SELECT COUNT(*) FROM settings")->fetchColumn();
if ($settingsCount == 0) {
    $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)")->execute(['rewards', json_encode(['xpPerPhp' => 0.5, 'pointsPerPhp' => 0.05, 'pointsToPhpRate' => 1, 'expressSurcharge' => 0])]);
    $results[] = ['status' => 'ok', 'message' => 'Inserted default settings'];
}

respond(['success' => true, 'message' => 'Database setup complete', 'results' => $results]);
