# School Logo Migration Summary

## Date: 2026-01-19

## Status: COMPLETED ✅

### Schools in Production

| School Name | UUID | Status |
|-------------|------|--------|
| Institución Educativa Caracas | `499b95b0-9126-42cf-a83b-a39f78624efc` | ✅ Directory created |
| Institución Educativa Alfonso López Pumarejo | `539b2ef5-9ea8-4ea3-b097-219f61954259` | ✅ Directory created |
| Institución Educativa El Pinal | `545e8991-e1f2-4c10-9315-adcdc74ce1f5` | ✅ Directory created |
| +caicedo | `eb140644-9a7e-4acd-85cf-609b41c44f20` | ✅ Directory created |
| CONFAMA | `45a33bc8-a732-4208-b99f-91f100077114` | ✅ Directory created |

### Actions Completed

1. ✅ Retrieved school UUIDs from production database
2. ✅ Created directory structure: `/var/www/uniformes-system-v2/uploads/schools/{uuid}/`
3. ✅ Set correct permissions: `www-data:www-data` with `755`
4. ✅ Created README documentation in schools directory
5. ✅ Verified FastAPI static files configuration

### Directory Structure

```
/var/www/uniformes-system-v2/uploads/
├── documents/
├── garment-types/
├── global-garment-types/
├── payment-proofs/
└── schools/                                    # NEW
    ├── README.md
    ├── 499b95b0-9126-42cf-a83b-a39f78624efc/  # Caracas
    ├── 539b2ef5-9ea8-4ea3-b097-219f61954259/  # Alfonso López
    ├── 545e8991-e1f2-4c10-9315-adcdc74ce1f5/  # El Pinal
    ├── eb140644-9a7e-4acd-85cf-609b41c44f20/  # Caicedo
    └── 45a33bc8-a732-4208-b99f-91f100077114/  # CONFAMA
```

### Access URLs

School logos will be accessible via:
```
https://api.yourdomain.com/uploads/schools/{school_uuid}/logo.png
```

Example:
```
https://api.yourdomain.com/uploads/schools/499b95b0-9126-42cf-a83b-a39f78624efc/logo.png
```

### Current State

- All schools currently have `logo_url = NULL` in database
- Directories are ready to receive logo uploads
- No existing logos needed to be migrated (clean slate)

### Next Steps

When implementing logo upload functionality:

1. **Upload Endpoint** (already exists if using school routes):
   ```python
   POST /api/v1/schools/{school_id}/logo
   Content-Type: multipart/form-data
   ```

2. **Save logic**:
   - Save file to: `/var/www/uniformes-system-v2/uploads/schools/{school_id}/logo.{ext}`
   - Update database: `UPDATE schools SET logo_url = '/uploads/schools/{school_id}/logo.{ext}' WHERE id = {school_id}`

3. **Retrieve**:
   - Get school: `GET /api/v1/schools/{school_id}`
   - Returns: `{"logo_url": "/uploads/schools/{uuid}/logo.png"}`
   - Frontend constructs full URL: `https://api.yourdomain.com{logo_url}`

### Permissions

All directories and files should maintain:
- Owner: `www-data:www-data`
- Directories: `755` (rwxr-xr-x)
- Files: `644` (rw-r--r--)

### Backup Considerations

- School logos are now part of `/var/www/uniformes-system-v2/uploads/`
- Should be included in backup strategy
- Consider versioning if logo changes are frequent

### Testing Checklist

Before deploying logo upload feature:
- [ ] Test upload endpoint with PNG file
- [ ] Test upload endpoint with JPEG file
- [ ] Verify file permissions after upload
- [ ] Verify database logo_url is updated
- [ ] Test retrieval via GET /schools/{id}
- [ ] Test direct URL access via browser
- [ ] Test logo display in web portal
- [ ] Test logo display in admin portal
- [ ] Test handling of missing logo (default/placeholder)

---

**Migration Script**: `/tmp/migrate_school_logos.py` (archived, not needed since no logos existed)
**Documentation**: `/var/www/uniformes-system-v2/uploads/schools/README.md`
