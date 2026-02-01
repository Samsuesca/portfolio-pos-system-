# School UUID Reference

Quick reference for production school IDs and slugs.

## Production Schools

| School Name | UUID | Slug | Directory Path |
|-------------|------|------|----------------|
| Institución Educativa Caracas | `499b95b0-9126-42cf-a83b-a39f78624efc` | `instituci-n-educativa-caracas` | `/uploads/schools/499b95b0-9126-42cf-a83b-a39f78624efc/` |
| Institución Educativa Alfonso López Pumarejo | `539b2ef5-9ea8-4ea3-b097-219f61954259` | `instituci-n-educativa-alfonso-l-pez-pumarejo` | `/uploads/schools/539b2ef5-9ea8-4ea3-b097-219f61954259/` |
| Institución Educativa El Pinal | `545e8991-e1f2-4c10-9315-adcdc74ce1f5` | `instituci-n-educativa-el-pinal` | `/uploads/schools/545e8991-e1f2-4c10-9315-adcdc74ce1f5/` |
| +caicedo | `eb140644-9a7e-4acd-85cf-609b41c44f20` | `caicedo` | `/uploads/schools/eb140644-9a7e-4acd-85cf-609b41c44f20/` |
| CONFAMA | `45a33bc8-a732-4208-b99f-91f100077114` | `confama` | `/uploads/schools/45a33bc8-a732-4208-b99f-91f100077114/` |

## Usage Examples

### SQL Queries

```sql
-- Get all schools
SELECT id, name, slug, logo_url FROM schools;

-- Get specific school
SELECT * FROM schools WHERE id = '499b95b0-9126-42cf-a83b-a39f78624efc';

-- Update logo URL
UPDATE schools 
SET logo_url = '/uploads/schools/499b95b0-9126-42cf-a83b-a39f78624efc/logo.png' 
WHERE id = '499b95b0-9126-42cf-a83b-a39f78624efc';
```

### API Endpoints

```bash
# Get school details
curl https://api.yourdomain.com/api/v1/schools/499b95b0-9126-42cf-a83b-a39f78624efc

# Upload logo (multipart/form-data)
curl -X POST \
  https://api.yourdomain.com/api/v1/schools/499b95b0-9126-42cf-a83b-a39f78624efc/logo \
  -H "Authorization: Bearer {token}" \
  -F "file=@logo.png"

# Access logo directly
https://api.yourdomain.com/uploads/schools/499b95b0-9126-42cf-a83b-a39f78624efc/logo.png
```

### File System Operations

```bash
# SSH to server
ssh -i ~/.ssh/id_ed25519_vultr root@104.156.247.226

# Navigate to school directory
cd /var/www/uniformes-system-v2/uploads/schools/499b95b0-9126-42cf-a83b-a39f78624efc

# Upload logo manually
scp -i ~/.ssh/id_ed25519_vultr logo.png root@104.156.247.226:/var/www/uniformes-system-v2/uploads/schools/499b95b0-9126-42cf-a83b-a39f78624efc/

# Set permissions
chown www-data:www-data logo.png
chmod 644 logo.png
```

## Notes

- UUIDs are the primary identifier for schools
- Slugs are used for URL-friendly routing (web portal)
- Logo URLs use UUIDs for directory structure (not slugs)
- All logos should be owned by `www-data:www-data`

## Related Documentation

- [School Logo Migration](./deployment/SCHOOL_LOGO_MIGRATION_2026-01-19.md)
- [Infrastructure Architecture](./deployment/infrastructure-architecture.md)

---

Last updated: 2026-01-19
Retrieved from production database via:
```sql
SELECT id, slug, name FROM schools ORDER BY created_at;
```
