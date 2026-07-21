begin;

insert into organizations(name,code)
values('A25 Hotel','A25')
on conflict(code) do update set name=excluded.name;

with branch_catalog(name,code,address) as (
  values
    ('66 Trần Thái Tông','TTT66','66 Trần Thái Tông'),
    ('63A Phương Liệt','PL63A','63A Phương Liệt'),
    ('385 Hoàng Quốc Việt','HQV385','385 Hoàng Quốc Việt'),
    ('25 Dịch Vọng Hầu','DVH25','25 Dịch Vọng Hầu'),
    ('45 Phan Chu Trinh','PCT45','45 Phan Chu Trinh'),
    ('26 Hàng Nón','HN26','26 Hàng Nón'),
    ('12 Liên Trì','LT12','12 Liên Trì'),
    ('96 Hai Bà Trưng','HBT96','96 Hai Bà Trưng'),
    ('15 Trần Quốc Toản','TQT15','15 Trần Quốc Toản'),
    ('221-223 Bạch Mai','BM221','221-223 Bạch Mai'),
    ('31 Trương Công Giai','TCG31','31 Trương Công Giai'),
    ('21 Nghĩa Tân','NT21','21 Nghĩa Tân'),
    ('21 Lê Đức Thọ','LDT21','21 Lê Đức Thọ'),
    ('57 Quang Trung','QT57','57 Quang Trung'),
    ('187 Lò Đúc','LD187','187 Lò Đúc'),
    ('12 Ngô Sỹ Liên','NSL12','12 Ngô Sỹ Liên'),
    ('684 Minh Khai','MK684','684 Minh Khai'),
    ('109 Trúc Bạch','TB109','109 Trúc Bạch'),
    ('44 Hàng Bún','HB44','44 Hàng Bún'),
    ('46 Châu Long','CL46','46 Châu Long'),
    ('15 Hàng Than','HT15','15 Hàng Than'),
    ('Đội Cấn 1','DC1','Đội Cấn 1'),
    ('Đội Cấn 2','DC2','Đội Cấn 2'),
    ('23 Quán Thánh','QT23','23 Quán Thánh'),
    ('30 An Dương','AD30','30 An Dương'),
    ('45B Giảng Võ','GV45B','45B Giảng Võ'),
    ('28 Trần Quý Cáp','TQC28','28 Trần Quý Cáp'),
    ('88 Nguyễn Khuyến','NK88','88 Nguyễn Khuyến'),
    ('19 Phan Đình Phùng','PDP19','19 Phan Đình Phùng'),
    ('16 Miếu Đầm','MD16','16 Miếu Đầm'),
    ('12 Phố Huế','PH12','12 Phố Huế'),
    ('Hoàng Đạo Thúy 1','HDT1','Hoàng Đạo Thúy 1'),
    ('193 Trung Kính','TK193','193 Trung Kính'),
    ('18 Nguyễn Hy Quang','NHQ18','18 Nguyễn Hy Quang'),
    ('19 Chả Cá','CC19','19 Chả Cá'),
    ('80 Mai Hắc Đế','MHD80','80 Mai Hắc Đế'),
    ('705 Lạc Long Quân','LLQ705','705 Lạc Long Quân'),
    ('Hoàng Đạo Thúy 2','HDT2','Hoàng Đạo Thúy 2'),
    ('130 Bà Triệu','BT130','130 Bà Triệu'),
    ('36 Giang Văn Minh','GVM36','36 Giang Văn Minh'),
    ('277 Lê Thánh Tôn','LTT277','277 Lê Thánh Tôn'),
    ('255 Lê Thánh Tôn','LTT255','255 Lê Thánh Tôn'),
    ('55 Lê Anh Xuân','LAX55','55 Lê Anh Xuân'),
    ('25 Trương Định','TD25','25 Trương Định'),
    ('06 Trương Định','TD06','06 Trương Định'),
    ('20 Bùi Thị Xuân','BTX20','20 Bùi Thị Xuân'),
    ('142 Bùi Thị Xuân','BTX142','142 Bùi Thị Xuân'),
    ('29 Bùi Thị Xuân','BTX29','29 Bùi Thị Xuân'),
    ('14 Lương Hữu Khánh','LHK14','14 Lương Hữu Khánh'),
    ('274 Đề Thám','DT274','274 Đề Thám'),
    ('22 Nguyễn Cư Trinh','NCT22','22 Nguyễn Cư Trinh'),
    ('65G Nguyễn Thái Học','NTH65G','65G Nguyễn Thái Học'),
    ('55 Lê Thị Hồng Gấm','LTHG55','55 Lê Thị Hồng Gấm'),
    ('75 Lê Thị Hồng Gấm','LTHG75','75 Lê Thị Hồng Gấm'),
    ('251 Hai Bà Trưng','HBT251','251 Hai Bà Trưng'),
    ('167 Phạm Ngũ Lão','PNL167','167 Phạm Ngũ Lão'),
    ('14 Hồ Huấn Nghiệp','HHN14','14 Hồ Huấn Nghiệp'),
    ('307 Lý Tự Trọng','LTT307','307 Lý Tự Trọng'),
    ('55 Cách Mạng Tháng 8','CMT8-55','55 Cách Mạng Tháng 8'),
    ('14 Phó Đức Chính','PDC14','14 Phó Đức Chính'),
    ('35 Mạc Thị Bưởi','MTB35','35 Mạc Thị Bưởi'),
    ('137 Nguyễn Du','ND137','137 Nguyễn Du'),
    ('31 Thanh Niên','TN31','31 Thanh Niên'),
    ('29 Thác Bạc','TB29','29 Thác Bạc')
)
insert into branches(organization_id,name,code,address)
select organization.id,catalog.name,catalog.code,catalog.address
from organizations organization
cross join branch_catalog catalog
where organization.code='A25'
on conflict(organization_id,code) do update
set name=excluded.name,
    address=coalesce(branches.address,excluded.address);

commit;
