# Thành Phố Xanh

Demo game khám phá thành phố trên trình duyệt, lấy cảm hứng từ thành phố pixel-art nhiều màu sắc trong ảnh tham khảo. Nhân vật và hình ảnh là nguyên gốc, không dùng tài sản Pokémon hoặc One Piece.

## Chạy dự án

Yêu cầu Node.js 20.19+ hoặc 22.12+.

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal. `npm run build` tạo bản build trong `dist/`; `npm run preview` chạy thử bản build.

## Cách chơi

- **WASD / phím mũi tên**: di chuyển; **Shift**: chạy.
- **E**: khám phá địa điểm khi đến gần; tìm ba điểm đánh dấu màu vàng.
- **Q**: đổi giữa camera nhìn từ trên xuống (mặc định) và camera 3D sau lưng. Cả hai được dựng 3D và render ở độ phân giải thấp để tạo cảm giác pixel.
- **M** hoặc nút **Bản đồ lớn**: di chuyển nhanh giữa các khu vực; **Esc**: tạm dừng.
- Trên màn hình cảm ứng, dùng các nút điều khiển hiển thị trên màn hình.
- Qua sông bằng những cây cầu. Các tòa nhà có va chạm cơ bản.

## Phạm vi 50 km

Thế giới có giới hạn **50 × 50 km**, với một đơn vị mô phỏng tương ứng một mét. Các khu phố, đường, cây và công trình được tạo xác định theo từng khối 128 m và tải quanh người chơi. Đây là nội dung **tạo tự động, có lặp lại**, không phải 2.500 km² nội dung thủ công hay mô hình một thành phố ngoài đời. Ba điểm khám phá được đặt thủ công gần trung tâm; các điểm di chuyển nhanh cho phép xem những khu vực xa. Độ chi tiết đồ họa và nội dung vẫn là bản demo hackathon.

Tiến trình được lưu trong `localStorage` của trình duyệt sau tương tác, định kỳ khi chơi và khi rời trang. Dữ liệu chỉ tồn tại trên trình duyệt/thiết bị đó; xóa dữ liệu trang có thể làm mất save.

## Công nghệ

Node.js, Vite, Three.js và JavaScript thuần. Game chạy phía trình duyệt, không cần tài khoản, thanh toán hoặc backend. Hình nền pixel-art của menu được tạo bằng AI. Nhân vật có animation từ Quaternius và nhà và cây cối từ Kenney (CC0); các thành phần còn lại của thế giới 3D dùng hình học và texture dựng bằng mã. Thông tin nguồn và giấy phép có trong `public/assets/models/CREDITS.md`.
