# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Creating the First Admin

To create the first administrator account, you need to manually insert a row into the `user_roles` table. This must be done directly in the database using SQL, as there is no UI for this (by design, for security).

### Steps:

1. **Identify the user ID** of the account you want to make admin. You can find this in the `profiles` table:
   ```sql
   SELECT id, email, full_name FROM profiles WHERE email = 'your-email@example.com';
   ```

2. **Insert the admin role** into `user_roles`:
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('user-id-from-step-1', 'admin');
   ```

3. **Verify the role was granted**:
   ```sql
   SELECT ur.user_id, p.email, ur.role, ur.created_at
   FROM user_roles ur
   JOIN profiles p ON p.id = ur.user_id
   WHERE ur.role = 'admin';
   ```

4. **The user can now access `/admin`**. The `is_admin` flag on their profile is automatically synchronized via a database trigger.

### Notes:

- Only users with the `admin` role in `user_roles` can access the admin panel
- The `is_admin` column on `profiles` is a denormalized mirror kept in sync by triggers
- Admin actions are logged in `admin_audit_log` for accountability
- To revoke admin access, delete the row from `user_roles`:
  ```sql
  DELETE FROM user_roles WHERE user_id = 'user-id' AND role = 'admin';
  ```

