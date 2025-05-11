from pathlib import Path

# List of files to create
files = [
    'src/app.ts',
    'src/server.ts',
    'src/config/default.ts',
    'src/config/db.ts',
    'src/controllers/product.controller.ts',
    'src/controllers/admin.product.controller.ts',
    'src/controllers/balance.controller.ts',
    'src/controllers/admin.balance.controller.ts',
    'src/controllers/notification.controller.ts',
    'src/models/balance.model.ts',
    'src/models/fx-rate.model.ts',
    'src/models/notification.model.ts',
    'src/models/product.model.ts',
    'src/models/merchant.model.ts',
    'src/models/settings.model.ts',
    'src/modules/commerce/index.ts',
    'src/routes/product.routes.ts',
    'src/routes/finance.routes.ts',
    'src/routes/notification.routes.ts',
    'src/routes/admin.routes.ts',
    'src/services/fx.service.ts',
    'src/services/balance.service.ts',
    'src/services/product.service.ts',
    'src/services/notification.service.ts',
    'src/services/cron.service.ts',
    'src/services/init.service.ts',
    'src/utils/redis.ts',
    'src/utils/logger.ts',
]

for file_path in files:
    path = Path(file_path)
    # Create parent directories if they don't exist
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {path.parent}")

    # Create the file if it doesn't exist
    if not path.exists():
        path.touch()
        print(f"Created file: {path}")
    else:
        print(f"Skipped existing file: {path}")
