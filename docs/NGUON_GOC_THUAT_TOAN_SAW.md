# Nguồn gốc thuật toán SAW (Simple Additive Weighting)

> Tài liệu này trả lời câu hỏi: **"Thuật toán SAW do ai phát triển?"** — để trích dẫn học thuật khi
> báo cáo. Đây là thông tin về **phương pháp SAW nói chung** trong ngành Multi-Criteria Decision
> Making (MCDM/ra quyết định đa tiêu chí), **không phải** thông tin về ai viết đoạn code SAW cụ thể
> trong project (file `smartParkingAlgorithms.ts` không có ghi chú tác giả).

---

## 1. Trả lời ngắn

Các nguồn học thuật **không hoàn toàn thống nhất** về việc ai là người đầu tiên đề xuất SAW. Có
hai luồng ghi nhận khác nhau, cả hai đều xuất hiện phổ biến trong các bài báo/sách MCDM:

| Luồng ghi nhận | Tác giả | Năm | Xuất hiện trong |
|---|---|---|---|
| **Luồng 1** (phổ biến hơn trong các bài tổng quan gần đây) | Fishburn, và MacCrimmon | 1967, 1968 | Nhiều sách/chương MCDM (ví dụ Wang & Rangaiah 2017 dẫn lại; các bài arXiv 2024–2025) |
| **Luồng 2** (xuất hiện trong một số bài ứng dụng, đặc biệt hướng supplier selection) | Harsanyi | 1955 | Một số bài báo ứng dụng SAW/TOPSIS |

Vì hai luồng này không khớp nhau và mình không tìm được bài gốc năm 1955/1967/1968 để đối chiếu
trực tiếp, **khuyến nghị khi báo cáo với thầy: nêu rõ có nhiều nguồn ghi nhận khác nhau**, không
chốt một cái tên duy nhất là "người phát triển" — trừ khi thầy yêu cầu bạn tự chọn 1 nguồn để trích.

---

## 2. Chi tiết từng nguồn tìm được

### 2.1. Luồng ghi nhận Fishburn (1967) / MacCrimmon (1968)

SAW còn được gọi là **Weighted Sum Method (WSM)**. Theo mô tả này, phương pháp:
- Chuẩn hoá ma trận quyết định bằng max normalization.
- Nhân trọng số với giá trị đã chuẩn hoá của từng tiêu chí, cho từng phương án.
- Cộng tổng lại thành 1 điểm cho mỗi phương án.
- Phương án điểm cao nhất được chọn.

Nguồn trích: một chương sách về MCDM trong kỹ thuật hoá học ghi nhận SAW (hay WSM) <cite index="20-1">được mô tả trong công trình của Fishburn (1967) và MacCrimmon (1968), là phương pháp tổng hợp đơn giản nhất trong nhóm MCDM</cite>. Một bài khác về thiết kế sản phẩm/hệ thống nhắc lại tương tự: <cite index="23-1">SAW có thể là phương pháp MCDM đơn giản nhất, được trình bày lần đầu trong Fishburn (1967) và MacCrimmon (1968)</cite>. Một bài về tối ưu hoá trong lọc hoá dầu cũng ghi nhận cùng hai tác giả này cho SAW.

### 2.2. Luồng ghi nhận Harsanyi (1955)

Một bài nghiên cứu về kết hợp SAW và TOPSIS cho bài toán chọn nhà cung cấp ghi nhận khác: <cite index="19-1">phương pháp SAW được giới thiệu lần đầu bởi Harsanyi vào năm 1955, và nhờ quy trình đơn giản nên trở nên phổ biến, được dùng rộng rãi trong các bài toán MCDM</cite>. Cùng bài này cũng tóm tắt quy trình 4 bước của SAW: chuẩn hoá ma trận quyết định, nhân trọng số tiêu chí với giá trị chuẩn hoá, cộng tổng lại thành điểm, và chọn phương án điểm cao nhất — quy trình này khớp với cách file `THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mô tả `scoreSAW()` đang làm.

### 2.3. Vị trí của SAW trong hệ thống các phương pháp MCDM

SAW thuộc nhóm phương pháp dựa trên "value function" (hàm giá trị) — nghĩa là gán một con số cho mỗi phương án sao cho thứ tự các con số phản ánh đúng thứ tự ưu tiên của người ra quyết định. Một bài so sánh SAW với TOPSIS (một phương pháp MCDM khác, phổ biến hơn) mô tả: <cite index="18-1">SAW là một ví dụ trong nhóm phương pháp mà các hàm giá trị thành phần chính là các phép đồng nhất (identity) — nghĩa là giá trị của một phương án bằng tổng có trọng số của các điểm đánh giá trên từng tiêu chí</cite>. Cùng bài này ghi nhận: <cite index="18-1">SAW là phương pháp tham chiếu trong công trình nền tảng của Zanakis và cộng sự (1998), nhờ tính đơn giản vốn có của nó</cite>.

TOPSIS — phương pháp thường bị đem so sánh/cạnh tranh với SAW, và cũng từng được cân nhắc trong file gốc (mục 8, dòng "TOPSIS chạy song song để cross-validate → Đã bỏ hẳn") — có nguồn gốc rõ ràng hơn: <cite index="18-1">TOPSIS ban đầu do Hwang và Yoon phát triển năm 1981, sau đó được Yoon hoàn thiện thêm năm 1987 và Hwang cùng cộng sự năm 1993</cite>.

### 2.4. SAW còn được gọi là gì khác

Ngoài tên SAW, phương pháp này còn thường được gọi là **Weighted Sum Method/Model (WSM)** hoặc **weighted linear combination**. Một bài tổng quan gần đây (2024) khẳng định lại: SAW, còn gọi là weighted sum method, mô tả trong Fishburn (1967) và MacCrimmon (1968), là một trong những phương pháp cơ bản và đơn giản nhất trong MCDM, dựa trên nguyên tắc: phương án xếp hạng cao nhất là phương án có tổng có trọng số của các giá trị tiêu chí đã chuẩn hoá lớn nhất, sau khi đã chuyển các tiêu chí kiểu cost (chi phí — càng nhỏ càng tốt) thành kiểu benefit (lợi ích — càng lớn càng tốt).

---

## 3. Vì sao có 2 mốc thời gian khác nhau (1955 và 1967/1968)?

Đây chỉ là suy đoán hợp lý, không phải kết luận chắc chắn (đánh dấu Need Confirm nếu cần độ chính xác học thuật cao):

- Harsanyi (1955) là nhà kinh tế học/triết học, công trình năm đó liên quan đến lý thuyết tổng hợp
  độ hữu dụng (utility) giữa nhiều cá nhân — có thể là **tiền đề lý thuyết** (ý tưởng cộng có trọng
  số các giá trị) chứ chưa phải đúng "phương pháp SAW" theo cách được đóng gói và gọi tên sau này.
- Fishburn (1967) và MacCrimmon (1968) là các công trình thường được trích khi nói cụ thể về
  "Simple Additive Weighting" / "Weighted Sum Model" như một phương pháp MCDM có tên riêng, có quy
  trình 4 bước rõ ràng (chuẩn hoá → nhân trọng số → cộng → chọn max).

→ Nếu thầy hỏi kỹ, cách trả lời an toàn: *"SAW có gốc ý tưởng từ lý thuyết tổng hợp giá trị có
trọng số (một số tài liệu dẫn về Harsanyi 1955), nhưng phương pháp được đóng gói và phổ biến với
tên Simple Additive Weighting / Weighted Sum Model thường được trích dẫn từ Fishburn (1967) và
MacCrimmon (1968)."*

**[Need Confirm]**: Đây là suy luận của mình dựa trên các trích dẫn tìm được qua web search, không
phải đọc trực tiếp bài báo gốc năm 1955/1967/1968. Nếu cần trích dẫn chính xác 100% cho báo cáo học
thuật (có DOI, số trang), nên tra trực tiếp các nguồn sau.

---

## 4. SAW được dùng trong những hệ thống/lĩnh vực nào

SAW là một trong các phương pháp lâu đời và được dùng rộng rãi nhất trong nhóm MCDM/MADM (ra
quyết định đa thuộc tính), thường nằm trong một **Hệ thống hỗ trợ ra quyết định** (Decision Support
System – DSS). Một bài hướng dẫn từng bước về SAW mô tả: (cite index="28-1">SAW là một trong những phương pháp ra quyết định lâu đời và được sử dụng rộng rãi nhất, có quy trình đơn giản nên được áp dụng trong nhiều lĩnh vực khác nhau như kỹ thuật, khoa học môi trường và năng lượng</cite>. Cùng bài này liệt kê một số ví dụ ứng dụng cụ thể đã ghi nhận trong các nghiên cứu: xếp hạng dịch vụ render đám mây (cloud render farm), đánh giá chất lượng sống đô thị, đánh giá rủi ro trong các dự án hợp tác công-tư (PPP), chọn thiết bị hiệu quả nhất, nghiên cứu năng lượng khả dụng, và chọn cảm biến gắn vào thiết bị.

Ngoài các ví dụ trên, các nghiên cứu khác (đa số dạng đồ án/luận văn CNTT, đặc biệt phổ biến ở
Indonesia) đã ứng dụng SAW để xây dựng DSS cho rất nhiều bài toán xếp hạng/chọn lựa khác nhau,
tương tự về cấu trúc với bài toán "gợi ý chỗ đỗ xe" của bạn (nhiều phương án, nhiều tiêu chí có
trọng số, chọn phương án điểm cao nhất). Một số ví dụ cụ thể:

| Lĩnh vực ứng dụng | Bài toán cụ thể |
|---|---|
| Giáo dục | Chọn trường tốt nhất; xác định học sinh xuất sắc không thuộc diện học thuật; đánh giá mức độ sẵn sàng đi làm của học viên |
| Nhân sự/doanh nghiệp | Xác định nhân viên được nhận thưởng (bonus) dựa trên hiệu suất; chọn ngành/chuyên môn phù hợp |
| Kỷ luật/quản lý học sinh | Xác định loại và mức độ xử phạt học sinh vi phạm (kết hợp SAW với Decision Table) |
| Địa lý/quy hoạch | Xác định khu vực làm việc cho hợp tác xã; tích hợp với GIS (Geographic Information System) qua phép toán overlay |
| Kinh tế/quản lý giá | Kiểm soát giá hàng hoá thiết yếu (sembako) |
| Từ thiện/xã hội | Xác định đối tượng nhận zakat (mustahiq) tại một tổ chức BAZNAS |
| Tiêu dùng | Chọn laptop tốt nhất theo tiêu chí hiệu năng/giá |

Điểm chung của mọi ứng dụng trên: đều là bài toán **xếp hạng nhiều phương án dựa trên nhiều tiêu
chí có trọng số khác nhau**, cùng cấu trúc với gợi ý chỗ đỗ xe (5 tiêu chí C1–C5 có trọng số, chấm
điểm mọi chỗ trống, chọn điểm cao nhất) — nên có thể trích các ứng dụng này làm dẫn chứng "SAW là
phương pháp đã được kiểm chứng rộng rãi trong thực tế, không phải mới phát minh riêng cho đồ án".

---

## 5. SAW đã được kiểm chứng gì trong học thuật

### 5.1. Đã được kiểm chứng: SAW cho kết quả xếp hạng ổn định hơn TOPSIS

Phương pháp thường bị so sánh trực tiếp với SAW là TOPSIS (kỹ thuật xếp hạng theo độ tương tự với
giải pháp lý tưởng). Một nghiên cứu so sánh thực nghiệm giữa hai phương pháp ghi nhận: (cite index="37-1">mặc dù TOPSIS không khó triển khai, nó vẫn cần nhiều công sức tính toán hơn SAW; và các nghiên cứu đã chỉ ra TOPSIS gặp phải hiện tượng "đảo hạng" (rank reversal) — vấn đề không ảnh hưởng đến các phương pháp kiểu SAW</cite>. Một tóm tắt khác của cùng nghiên cứu này khẳng định rõ hơn: (cite index="38-1">TOPSIS dễ bị đảo hạng, đặc biệt với khoảng cách Tchebychev, trong khi SAW ổn định hơn do bản chất cộng (additive) của nó</cite>.

"Đảo hạng" (rank reversal) là hiện tượng nguy hiểm trong thực tế: thứ tự xếp hạng giữa 2 phương án
có thể **đổi chỗ** chỉ vì thêm/bớt một phương án không liên quan vào danh sách so sánh — với DSS
gợi ý chỗ đỗ xe, điều này nghĩa là thêm 1 chỗ trống mới vào bãi có thể (về lý thuyết, ở TOPSIS)
làm đổi thứ tự ưu tiên giữa 2 chỗ trống cũ mà chẳng liên quan gì đến chỗ mới đó — SAW không có rủi
ro này.

### 5.2. Đã được kiểm chứng: khi tăng số phương án, SAW và TOPSIS cho kết quả gần giống nhau hơn

Từ cùng nghiên cứu: (cite index="38-1">các thí nghiệm ngẫu nhiên cho thấy khi số lượng phương án tăng lên, chỉ số tương đồng giữa TOPSIS và SAW có xu hướng cải thiện đáng kể</cite>. Với bãi đỗ xe có hàng chục/hàng trăm chỗ trống, đây là điểm có lợi: SAW và các phương pháp phức tạp hơn nhiều khả năng cho kết quả tương đồng, nên dùng SAW (đơn giản, rẻ tính toán) không đánh đổi nhiều về độ chính xác.

### 5.3. Hạn chế đã được ghi nhận: SAW không có chỉ số đo độ nhất quán chính thức

Một bài tổng quan về các phương pháp MCDM dùng trong công nghiệp chỉ ra hạn chế quan trọng: (cite index="40-1">việc TOPSIS, VIKOR và SAW thiếu một chỉ số đo độ nhất quán chính thức không tự động có nghĩa là phương pháp không hợp lệ, nhưng nó đòi hỏi các biện pháp bù đắp — ví dụ đo độ nhạy của kết quả theo trọng số và theo cách chuẩn hoá</cite>. Cùng bài này cũng chỉ ra một giả định ẩn của SAW: (cite index="40-1">SAW, TOPSIS và VIKOR đều giả định các tiêu chí độc lập với nhau — một giả định hiếm khi đúng trong các hệ thống kỹ thuật thực tế</cite>.

→ Đây chính là điều tài liệu gốc của bạn (`THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md`, mục 4, ghi chú
về C2 và C5) đã tự phát hiện ra trong thực tế: C2 (tỷ lệ trống của khu) và C5 (độ đông đúc của khu)
đang đo cùng một đại lượng nhìn từ 2 chiều — đúng là vi phạm giả định "các tiêu chí độc lập" mà học
thuật đã cảnh báo trước. Đây là bằng chứng tốt để trích khi báo cáo: bạn không chỉ áp dụng SAW mà
còn đã tự phát hiện và ghi nhận đúng loại hạn chế mà tài liệu học thuật đã nêu.

### 5.4. Hạn chế đã được ghi nhận: không có một "phương pháp chuẩn" để đối chiếu

Một bài khác chỉ ra khó khăn cố hữu trong việc "kiểm chứng" bất kỳ phương pháp MCDM nào, kể cả SAW:
(cite index="18-1">một vấn đề thực tế thường gặp là việc tìm một phương pháp tham chiếu để đối chiếu kết quả (điểm số, thứ hạng, phương án được chọn) — SAW thường được dùng làm phương pháp tham chiếu chính trong các nghiên cứu nền tảng nhờ tính đơn giản của nó</cite>. Nói cách khác: SAW thường **được chọn làm chuẩn để các phương pháp khác so sánh với**, chứ không phải ngược lại — một dạng "kiểm chứng gián tiếp" qua việc nó được cộng đồng học thuật tin dùng làm baseline.

### 5.5. Trong nhiều bài so sánh thực tế (ứng dụng công nghiệp), SAW cho kết quả nhất quán với các phương pháp khác

Một nghiên cứu so sánh nhiều phương pháp MCDM trong đánh giá tính bền vững kỹ thuật ghi nhận: khi
so sánh SAW, TOPSIS và AHP cho bài toán chọn sân bay mới, cả ba phương pháp đều cho kết quả nhất
quán với nhau; tương tự với bài toán chọn nhiên liệu hàng không bền vững, so sánh SAW với các
phương pháp khác cũng cho ra thứ hạng nhất quán, chỉ có SAW là phương pháp có sai lệch nhẹ trong
một trường hợp. Kết luận chung của nghiên cứu này: việc chọn công cụ MCDM nào (SAW hay phương pháp
khác) không ảnh hưởng đáng kể đến thứ hạng cuối cùng trong ngữ cảnh đó.

### 5.6. Tóm tắt phần kiểm chứng để báo cáo

| Khía cạnh | Đã kiểm chứng gì | Nguồn |
|---|---|---|
| Ổn định xếp hạng | SAW không bị "đảo hạng" (rank reversal) như TOPSIS | Kaliszewski & Podkopaev 2016; bài so sánh TOPSIS-SAW 2023 |
| Độ tương đồng với phương pháp phức tạp hơn | Khi số phương án tăng, SAW cho kết quả càng gần TOPSIS | Bài so sánh TOPSIS-SAW 2023 |
| Được dùng làm baseline/chuẩn đối chiếu | SAW thường là phương pháp tham chiếu trong các nghiên cứu MCDM nền tảng | Zanakis et al. 1998 (dẫn qua Kaliszewski & Podkopaev 2016) |
| Hạn chế: thiếu chỉ số đo độ nhất quán chính thức | Đúng, cần bù bằng phân tích độ nhạy (sensitivity analysis) | MDPI 2025, tổng quan MCDM công nghiệp |
| Hạn chế: giả định tiêu chí độc lập | Đúng, hiếm khi đúng hoàn toàn trong hệ thống kỹ thuật thực tế — khớp với vấn đề C2/C5 tự phát hiện trong project | MDPI 2025 |
| Ứng dụng thực tế đa dạng | Hàng chục lĩnh vực: giáo dục, nhân sự, quy hoạch, tiêu dùng, môi trường, năng lượng... | Nhiều nghiên cứu ứng dụng 2013–2025 |

---

## 6. Nguồn tham khảo đã trích dẫn ở trên

1. Kaliszewski, I., Podkopaev, D. (2016). *Simple additive weighting — A metamodel for multiple
   criteria decision analysis methods*. Expert Systems with Applications, 54, 155–161.
   https://doi.org/10.1016/j.eswa.2016.01.042
2. Bài so sánh TOPSIS và SAW (2023). *A comparison between TOPSIS and SAW methods*.
   https://link.springer.com/article/10.1007/s10479-023-05339-w
   (bản PDF: https://eprints.whiterose.ac.uk/id/eprint/199927/1/s10479-023-05339-w.pdf)
3. Bài ứng dụng SAW–TOPSIS cho chọn nhà cung cấp (ghi nhận Harsanyi 1955).
   https://www.researchgate.net/publication/330351148
4. Chương sách MCDM trong kỹ thuật hoá học/quá trình (ghi nhận Fishburn 1967, MacCrimmon 1968).
   https://arxiv.org/pdf/2410.05713
5. Chương 15 — các phương pháp MCDM chọn lọc và ứng dụng vào thiết kế sản phẩm/hệ thống.
   https://arxiv.org/pdf/2407.09931
6. Bài tổng quan MCDM 2024–2025 (arXiv), nhắc lại Fishburn (1967)/MacCrimmon (1968).
   https://arxiv.org/pdf/2509.06388
7. Bài về tối ưu hoá đa mục tiêu trong cracking nhiệt sản xuất olefin, mục SAW.
   https://arxiv.org/pdf/2412.11035
8. Hướng dẫn từng bước về SAW như một kỹ thuật MADM (liệt kê các lĩnh vực ứng dụng).
   https://www.researchgate.net/publication/368959886
9. Bài tổng quan MCDM dùng trong môi trường công nghiệp (hạn chế: thiếu chỉ số nhất quán, giả định
   tiêu chí độc lập). https://www.mdpi.com/2227-7080/13/10/444
10. Các bài ứng dụng SAW trong DSS (chọn trường tốt nhất, xử phạt học sinh, khu vực hợp tác xã,
    kiểm soát giá sembako, zakat, laptop) — nguồn tổng hợp từ ResearchGate/SCITEPRESS/Academia.edu,
    dùng để minh hoạ độ phổ biến của SAW trong đồ án/luận văn CNTT, không phải nguồn học thuật
    chính thống có bình duyệt cao — nên chỉ trích với vai trò "ví dụ ứng dụng", không trích làm căn
    cứ lý thuyết.

---

## 7. Lưu ý phân biệt: nguồn gốc phương pháp SAW ≠ nguồn gốc đoạn code trong project

Câu hỏi gốc của bạn có thể hiểu theo 2 nghĩa. Tài liệu này chỉ trả lời nghĩa (a):

- **(a) Ai phát triển ra *phương pháp* SAW trong học thuật** → trả lời ở trên (Fishburn/MacCrimmon
  hoặc Harsanyi, tuỳ nguồn).
- **(b) Ai viết đoạn code SAW cụ thể trong project của bạn** (file `smartParkingAlgorithms.ts`) →
  **không có thông tin này trong bộ tài liệu project** (`THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md`
  không ghi tên người viết code, chỉ ghi ngày lập 21/09/2026 và trạng thái đã kiểm chứng). Nếu thầy
  hỏi theo nghĩa (b), cần bạn tự xác nhận (ví dụ tên bạn/nhóm làm đồ án) — mình không có dữ liệu để
  điền vào đây.
