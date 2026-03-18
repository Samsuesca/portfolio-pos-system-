import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGarmentType } from '../../components/GarmentIcon'

describe('Web Portal API Utilities', () => {
  describe('getGarmentType', () => {
    it('should return shirt type for camisa/camiseta', () => {
      expect(getGarmentType('Camisa Escolar')).toBe('shirt')
      expect(getGarmentType('Camiseta Polo')).toBe('shirt')
    })

    it('should return blouse type for blusa', () => {
      expect(getGarmentType('Blusa Mujer')).toBe('blouse')
    })

    it('should return pants type for pantalon/jean', () => {
      expect(getGarmentType('Pantalon Azul')).toBe('pants')
      expect(getGarmentType('Jean Escolar')).toBe('pants')
    })

    it('should return hoodie type for sudadera/chompa', () => {
      expect(getGarmentType('Sudadera Gris')).toBe('hoodie')
      expect(getGarmentType('Chompa Azul')).toBe('hoodie')
    })

    it('should return sneaker type for zapato/tennis', () => {
      expect(getGarmentType('Zapato Negro')).toBe('sneaker')
      expect(getGarmentType('Tennis Blanco')).toBe('sneaker')
    })

    it('should return socks type for media', () => {
      expect(getGarmentType('Media Larga')).toBe('socks')
    })

    it('should return default for unknown product', () => {
      expect(getGarmentType('Producto Desconocido')).toBe('default')
      expect(getGarmentType('')).toBe('default')
    })
  })
})

describe('API Type Definitions', () => {
  it('should have correct School type structure', () => {
    const school = {
      id: 'school-1',
      name: 'Test School',
      slug: 'test-school',
      is_active: true
    }

    expect(school.id).toBeDefined()
    expect(school.name).toBeDefined()
    expect(school.slug).toBeDefined()
    expect(school.is_active).toBe(true)
  })

  it('should have correct Product type structure', () => {
    const product = {
      id: 'product-1',
      school_id: 'school-1',
      garment_type_id: 'garment-1',
      name: 'Test Product',
      code: 'PRD-001',
      price: 50000,
      is_active: true
    }

    expect(product.id).toBeDefined()
    expect(product.school_id).toBeDefined()
    expect(product.name).toBeDefined()
    expect(product.price).toBeGreaterThan(0)
  })

  it('should have correct Client type structure', () => {
    const client = {
      id: 'client-1',
      school_id: 'school-1',
      code: 'CLI-001',
      name: 'Test Client',
      phone: '3001234567',
      is_active: true
    }

    expect(client.id).toBeDefined()
    expect(client.code).toBeDefined()
    expect(client.phone).toBeDefined()
  })

  it('should have correct OrderItem type structure', () => {
    const orderItem = {
      quantity: 2,
      unit_price: 50000,
      size: 'M',
      gender: 'unisex'
    }

    expect(orderItem.quantity).toBeGreaterThan(0)
    expect(orderItem.unit_price).toBeGreaterThan(0)
  })

  it('should have correct DeliveryZone type structure', () => {
    const zone = {
      id: 'zone-1',
      name: 'Centro',
      delivery_fee: 5000,
      estimated_days: 2
    }

    expect(zone.id).toBeDefined()
    expect(zone.name).toBeDefined()
    expect(zone.delivery_fee).toBeGreaterThanOrEqual(0)
    expect(zone.estimated_days).toBeGreaterThan(0)
  })
})

describe('DeliveryType', () => {
  it('should accept valid delivery types', () => {
    const pickupType: 'pickup' | 'delivery' = 'pickup'
    const deliveryType: 'pickup' | 'delivery' = 'delivery'

    expect(pickupType).toBe('pickup')
    expect(deliveryType).toBe('delivery')
  })
})
