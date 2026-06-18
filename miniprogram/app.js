// 宏源汽车服务 - 小程序端逻辑

const API_BASE = 'http://localhost:3000/api';
let openid = localStorage.getItem('wx_openid') || '';

// ==================== Tab切换 ====================
function switchTab(tabName, el) {
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    el.classList.add('active');
}

// ==================== 轮播Banner ====================
let bannerIndex = 0;
function rotateBanner() {
    const items = document.querySelectorAll('.banner-item');
    items.forEach((item, i) => {
        item.classList.toggle('active', i === bannerIndex);
    });
    bannerIndex = (bannerIndex + 1) % items.length;
}
setInterval(rotateBanner, 3000);

// ==================== 快速预约 ====================
function quickAppoint(service) {
    document.getElementById('wxServiceType').value = service;
    switchTab('appoint', document.querySelector('[data-tab=appoint]'));
}

// ==================== 提交预约 ====================
async function submitAppoint() {
    const service_type = document.getElementById('wxServiceType').value;
    const plate_number = document.getElementById('wxPlate').value.trim();
    const appointment_time = document.getElementById('wxAppointTime').value;
    const remark = document.getElementById('wxAppointRemark').value.trim();

    if (!plate_number) {
        showToast('请输入车牌号', 'error');
        return;
    }
    if (!appointment_time) {
        showToast('请选择预约时间', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/wx/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openid, service_type, plate_number, appointment_time, remark })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('预约成功！我们将尽快确认', 'success');
            document.getElementById('wxPlate').value = '';
            document.getElementById('wxAppointRemark').value = '';
        } else {
            showToast(data.msg || '预约失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
    }
}

// ==================== 查询工单 ====================
async function searchOrder() {
    const orderNo = document.getElementById('wxOrderNo').value.trim();
    const resultDiv = document.getElementById('wxOrderResult');
    const emptyDiv = document.getElementById('wxOrderEmpty');

    if (!orderNo) {
        resultDiv.classList.add('hidden');
        emptyDiv.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/wx/orders/${encodeURIComponent(orderNo)}`);
        const data = await res.json();
        if (data.code === 200) {
            const order = data.data;
            const statusMap = {
                'pending': { text: '待处理', class: 'pending', progress: 10 },
                'in_progress': { text: '维修中', class: 'in_progress', progress: 60 },
                'waiting_parts': { text: '等配件', class: 'in_progress', progress: 40 },
                'completed': { text: '已完成', class: 'completed', progress: 100 },
                'cancelled': { text: '已取消', class: 'pending', progress: 0 }
            };
            const s = statusMap[order.status] || { text: order.status, class: 'pending', progress: 0 };

            resultDiv.querySelector('.order-no').textContent = order.order_no;
            resultDiv.querySelector('.status-badge').textContent = s.text;
            resultDiv.querySelector('.status-badge').className = 'status-badge ' + s.class;
            resultDiv.querySelector('.order-car').textContent = (order.car_brand || '') + ' ' + (order.car_model || '');
            resultDiv.querySelector('.order-customer').textContent = order.customer_name || '';
            resultDiv.querySelector('.progress-fill').style.width = s.progress + '%';

            resultDiv.classList.remove('hidden');
            emptyDiv.classList.add('hidden');
        } else {
            emptyDiv.classList.remove('hidden');
            resultDiv.classList.add('hidden');
        }
    } catch (e) {
        console.error('查询失败', e);
    }
}

// ==================== 微信登录模拟 ====================
async function wxLogin() {
    // 实际小程序中调用 wx.login() 获取 code，再请求后端换取 openid
    // 这里模拟一个 openid
    if (!openid) {
        openid = 'wx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('wx_openid', openid);
        // 注册到后端
        try {
            await fetch(`${API_BASE}/wx/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: openid, user_info: { nickName: '微信用户' } })
            });
        } catch (e) {}
    }
}

// ==================== Toast ====================
function showToast(msg, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    wxLogin();
    // 设置默认预约时间为明天上午9点
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    document.getElementById('wxAppointTime').value = tomorrow.toISOString().slice(0, 16);
});
