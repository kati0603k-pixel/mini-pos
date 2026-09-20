'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const emptyForm = { sku: '', name: '', price: '', stock: '', unit: '' };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null); // id ของแถวที่กำลังแก้ไข
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ดึงสินค้าทั้งหมดจาก Supabase
  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // แปลงค่าจากฟอร์ม (string) เป็นชนิดที่ตรงกับฐานข้อมูล
  function toRow(f) {
    return {
      sku: f.sku.trim(),
      name: f.name.trim(),
      price: Number(f.price),
      stock: parseInt(f.stock, 10),
      unit: f.unit.trim(),
    };
  }

  // เพิ่มสินค้าใหม่
  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.from('products').insert(toRow(form));
    if (error) return setError(error.message);
    setForm(emptyForm);
    loadProducts();
  }

  // เริ่มแก้ไขแถว: คัดลอกค่าปัจจุบันมาใส่ฟอร์มแก้ไข
  function startEdit(p) {
    setEditingId(p.id);
    setEditForm({
      sku: p.sku ?? '',
      name: p.name ?? '',
      price: String(p.price),
      stock: String(p.stock),
      unit: p.unit ?? '',
    });
  }

  // บันทึกการแก้ไข
  async function handleSave(id) {
    setError('');
    const { error } = await supabase
      .from('products')
      .update(toRow(editForm))
      .eq('id', id);
    if (error) return setError(error.message);
    setEditingId(null);
    loadProducts();
  }

  // ลบสินค้า
  async function handleDelete(id) {
    if (!confirm('ต้องการลบสินค้านี้ใช่หรือไม่?')) return;
    setError('');
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return setError(error.message);
    loadProducts();
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>
      {error && <p className="error">{error}</p>}

      {/* ฟอร์มเพิ่มสินค้า */}
      <form className="card" onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="SKU" value={form.sku} required
          onChange={(e) => setForm({ ...form, sku: e.target.value })} style={{ width: 110 }} />
        <input placeholder="ชื่อสินค้า" value={form.name} required
          onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 1, minWidth: 150 }} />
        <input placeholder="ราคา" type="number" min="0" step="0.01" value={form.price} required
          onChange={(e) => setForm({ ...form, price: e.target.value })} style={{ width: 90 }} />
        <input placeholder="คงเหลือ" type="number" min="0" step="1" value={form.stock} required
          onChange={(e) => setForm({ ...form, stock: e.target.value })} style={{ width: 90 }} />
        <input placeholder="หน่วย" value={form.unit} required
          onChange={(e) => setForm({ ...form, unit: e.target.value })} style={{ width: 80 }} />
        <button type="submit">เพิ่มสินค้า</button>
      </form>

      {/* ตารางสินค้า */}
      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={6}>ยังไม่มีสินค้า</td></tr>
            )}
            {products.map((p) =>
              editingId === p.id ? (
                // แถวโหมดแก้ไข (inline)
                <tr key={p.id}>
                  <td><input value={editForm.sku} style={{ width: 90 }}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} /></td>
                  <td><input value={editForm.name} style={{ width: '100%' }}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                  <td><input type="number" min="0" step="0.01" value={editForm.price} style={{ width: 80 }}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></td>
                  <td><input type="number" min="0" step="1" value={editForm.stock} style={{ width: 80 }}
                    onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} /></td>
                  <td><input value={editForm.unit} style={{ width: 70 }}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleSave(p.id)}>บันทึก</button>{' '}
                    <button onClick={() => setEditingId(null)} style={{ background: '#6b7280' }}>ยกเลิก</button>
                  </td>
                </tr>
              ) : (
                // แถวโหมดปกติ
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{Number(p.price).toLocaleString()}</td>
                  <td>{p.stock}</td>
                  <td>{p.unit}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(p)}>แก้ไข</button>{' '}
                    <button onClick={() => handleDelete(p.id)} style={{ background: '#dc2626' }}>ลบ</button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
