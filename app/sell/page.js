'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // ตะกร้า: [{ id, qty }]
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ดึงรายการสินค้า
  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    if (error) setMessage({ type: 'error', text: error.message });
    else setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // รวมข้อมูลตะกร้ากับข้อมูลสินค้า แล้วคำนวณยอดรวมอัตโนมัติ
  const cartLines = cart
    .map((item) => ({ ...item, product: products.find((p) => p.id === item.id) }))
    .filter((l) => l.product);
  const total = cartLines.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0);
  const itemCount = cartLines.reduce((sum, l) => sum + l.qty, 0);

  // เพิ่มสินค้าลงตะกร้า (กดซ้ำ = เพิ่มจำนวนทีละ 1 แต่ไม่เกินสต็อก)
  function addToCart(p) {
    setMessage({ type: '', text: '' });
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) {
        if (existing.qty >= p.stock) return prev;
        return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      if (p.stock < 1) return prev;
      return [...prev, { id: p.id, qty: 1 }];
    });
  }

  // ปรับจำนวน (ขั้นต่ำ 1 ไม่เกินสต็อก)
  function setQty(id, value, stock) {
    let n = parseInt(value, 10);
    if (!n || n < 1) n = 1;
    if (n > stock) n = stock;
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: n } : i)));
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function fail(text) {
    setMessage({ type: 'error', text });
    setSaving(false);
  }

  // กดยืนยันขาย
  async function handleSell() {
    setMessage({ type: '', text: '' });
    if (cartLines.length === 0) return fail('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
    setSaving(true);

    // 1) ดึง stock ล่าสุดของทุกสินค้าในตะกร้า
    const ids = cartLines.map((l) => l.id);
    const { data: fresh, error: fetchErr } = await supabase
      .from('products')
      .select('id, stock')
      .in('id', ids);
    if (fetchErr) return fail(fetchErr.message);
    const stockMap = Object.fromEntries(fresh.map((r) => [r.id, r.stock]));

    // 2) ตรวจสอบสต็อกทุกรายการ
    const short = cartLines.filter((l) => (stockMap[l.id] ?? 0) < l.qty);
    if (short.length > 0) {
      loadProducts();
      return fail(
        'สินค้าไม่พอ: ' +
          short.map((l) => `${l.product.name} (เหลือ ${stockMap[l.id] ?? 0})`).join(', ')
      );
    }

    // 3) ตัดสต็อกทีละรายการ (เช็คว่า stock ยังเท่าเดิม กันขายชนกัน)
    const done = [];
    for (const l of cartLines) {
      const { data: upd, error: updErr } = await supabase
        .from('products')
        .update({ stock: stockMap[l.id] - l.qty })
        .eq('id', l.id)
        .eq('stock', stockMap[l.id])
        .select();
      if (updErr || !upd || upd.length === 0) {
        // พลาดกลางทาง -> คืนสต็อกรายการที่ตัดไปแล้ว
        for (const id of done) {
          await supabase.from('products').update({ stock: stockMap[id] }).eq('id', id);
        }
        loadProducts();
        return fail(updErr ? updErr.message : `สต็อกของ ${l.product.name} เปลี่ยนแปลง กรุณาลองใหม่`);
      }
      done.push(l.id);
    }

    // 4) บันทึกลงตาราง sales (1 รายการสินค้า = 1 แถว, เวลาขายเดียวกัน)
    const soldAt = new Date().toISOString();
    const rows = cartLines.map((l) => ({
      product_id: l.id,
      product_name: l.product.name,
      quantity: l.qty,
      total_price: Number(l.product.price) * l.qty,
      sold_at: soldAt,
    }));
    const { error: insErr } = await supabase.from('sales').insert(rows);
    if (insErr) {
      for (const id of done) {
        await supabase.from('products').update({ stock: stockMap[id] }).eq('id', id);
      }
      loadProducts();
      return fail(insErr.message);
    }

    // 5) สำเร็จ: แจ้งผล ล้างตะกร้า โหลดสต็อกใหม่
    setMessage({
      type: 'success',
      text: `ขายสำเร็จ ${cartLines.length} รายการ รวม ${total.toLocaleString()} บาท`,
    });
    setCart([]);
    setSaving(false);
    loadProducts();
  }

  // กรองสินค้าตามคำค้น (ชื่อหรือ SKU)
  const keyword = search.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      !keyword ||
      (p.name || '').toLowerCase().includes(keyword) ||
      (p.sku || '').toLowerCase().includes(keyword)
  );

  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div>
      {/* แถบยอดรวมด้านบน ตัวใหญ่ ค้างอยู่ตอนเลื่อนหน้า */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#111827',
          color: '#fff',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
            ยอดรวมทั้งหมด ({cartLines.length} รายการ / {itemCount} ชิ้น)
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1.1 }}>
            {total.toLocaleString()} <span style={{ fontSize: '1.5rem' }}>บาท</span>
          </div>
        </div>
        <button
          onClick={handleSell}
          disabled={saving || cartLines.length === 0}
          style={{
            background: saving || cartLines.length === 0 ? '#4b5563' : '#16a34a',
            fontSize: '1.4rem',
            padding: '16px 32px',
            fontWeight: 700,
          }}
        >
          {saving ? 'กำลังบันทึก...' : 'ยืนยันขาย'}
        </button>
      </div>

      {message.text && (
        <p className={message.type} style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {message.text}
        </p>
      )}

      {/* ซ้าย: เลือกสินค้า / ขวา: ตะกร้า (จอเล็กจะเรียงต่อกันอัตโนมัติ) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ส่วนเลือกสินค้า */}
        <div className="card">
          <h2>เลือกสินค้า</h2>
          <input
            placeholder="ค้นหาชื่อสินค้าหรือ SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', marginBottom: 12 }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 8,
              maxHeight: '55vh',
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 && <p>ไม่พบสินค้า</p>}
            {filtered.map((p) => {
              const inCart = cart.find((i) => i.id === p.id);
              const outOfStock = p.stock < 1;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={outOfStock}
                  style={{
                    background: outOfStock ? '#f3f4f6' : inCart ? '#dbeafe' : '#fff',
                    color: '#222',
                    border: inCart ? '2px solid #2563eb' : '1px solid #d1d5db',
                    textAlign: 'left',
                    padding: 10,
                    opacity: outOfStock ? 0.6 : 1,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: '#2563eb', fontWeight: 700 }}>
                    {Number(p.price).toLocaleString()} บาท
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {outOfStock ? 'หมด' : `เหลือ ${p.stock} ${p.unit || ''}`}
                    {inCart ? ` • ในตะกร้า ${inCart.qty}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ส่วนตะกร้า */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>ตะกร้า</h2>
            {cartLines.length > 0 && (
              <button onClick={() => setCart([])} style={{ background: '#6b7280' }}>
                ล้างตะกร้า
              </button>
            )}
          </div>

          {cartLines.length === 0 ? (
            <p style={{ color: '#6b7280' }}>ยังไม่มีสินค้า กดที่สินค้าด้านซ้ายเพื่อเพิ่ม</p>
          ) : (
            <div style={{ maxHeight: '55vh', overflowY: 'auto', marginTop: 12 }}>
              {cartLines.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 0',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{l.product.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {Number(l.product.price).toLocaleString()} บาท / {l.product.unit || 'หน่วย'}
                    </div>
                  </div>
                  <button onClick={() => setQty(l.id, l.qty - 1, l.product.stock)}>-</button>
                  <input
                    type="number"
                    min="1"
                    max={l.product.stock}
                    value={l.qty}
                    onChange={(e) => setQty(l.id, e.target.value, l.product.stock)}
                    style={{ width: 60, textAlign: 'center' }}
                  />
                  <button onClick={() => setQty(l.id, l.qty + 1, l.product.stock)}>+</button>
                  <div style={{ width: 90, textAlign: 'right', fontWeight: 700 }}>
                    {(Number(l.product.price) * l.qty).toLocaleString()}
                  </div>
                  <button onClick={() => removeFromCart(l.id)} style={{ background: '#dc2626' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
