'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ดึงประวัติการขายทั้งหมด เรียงจากล่าสุดไปเก่าสุด
  async function loadSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });
    if (error) setError(error.message);
    else setSales(data);
    setLoading(false);
  }

  useEffect(() => {
    loadSales();
  }, []);

  // ยอดขายรวมทั้งหมด (sum ของ total_price)
  const grandTotal = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  // จัดรูปแบบวันเวลาเป็นแบบไทย
  function formatDate(value) {
    return new Date(value).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div>
      <h1>ประวัติการขาย</h1>
      {error && <p className="error">{error}</p>}

      {/* ยอดขายรวม */}
      <div className="card">
        ยอดขายรวมทั้งหมด: <strong style={{ fontSize: '1.3rem' }}>{grandTotal.toLocaleString()}</strong> บาท
        <span style={{ color: '#6b7280', marginLeft: 12 }}>({sales.length} รายการ)</span>
      </div>

      {/* ตารางประวัติการขาย */}
      <table>
        <thead>
          <tr>
            <th>วันเวลาที่ขาย</th>
            <th>ชื่อสินค้า</th>
            <th>จำนวน</th>
            <th>ยอดรวม</th>
          </tr>
        </thead>
        <tbody>
          {sales.length === 0 && (
            <tr><td colSpan={4}>ยังไม่มีรายการขาย</td></tr>
          )}
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{formatDate(s.sold_at)}</td>
              <td>{s.product_name}</td>
              <td>{s.quantity}</td>
              <td>{Number(s.total_price).toLocaleString()} บาท</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
