#set page(width: 16cm, height: auto, margin: 1.2cm)
#set text(font: "TH Sarabun New", size: 16pt, lang: "th")
#show math.equation: set text(font: "STIX Two Math", size: 13pt)
#set par(justify: false, leading: 0.62em)
#let thai(s) = text(font: "TH Sarabun New", size: 16pt, s)
#let latin(s) = text(font: "STIX Two Math", size: 13pt, s)

#text(size: 17pt, weight: "bold")[chutcenter · พิสูจน์ typst.ts ในเบราว์เซอร์]
#v(4pt)#text(fill: rgb("#666"))[สัปดาห์วิทย์ ม.น. ปี 2559 ข้อ 20 — คอมไพล์สดในเบราว์เซอร์]
#v(8pt)#text(weight:"bold")[ข้อ 20.] #h(0.4em) ให้ \
$g lr((x)) = mat(delim: #("{", none), align: #left, column-gap: #1.4em, x^(2), class("punctuation", ";") " " x < 1 class("punctuation", ","); a x + b, class("punctuation", ";") " " 1 ≤ x ≤ 2 class("punctuation", ","); x^(3), class("punctuation", ";") " " x > 2)$ \
โดยที่ $a class("punctuation", ",") b ∈ ℝ$ ถ้า $g$ ต่อเนื่องที่จุด $x = 1$ และ $x = 2$ แล้ว $g lr((a + b + 1))$ เท่ากับข้อใด

#pad(left: 2em)[ก. #h(0.35em) $− 6$]
#pad(left: 2em)[ข. #h(0.35em) $1$]
#pad(left: 2em)[ค. #h(0.35em) $7$]
#pad(left: 2em)[ง. #h(0.35em) $8$]
#v(4pt)#text(fill: rgb("#2a6f2a"), weight:"bold")[เฉลย: ข้อ ง] #h(0.5em) 8
#v(2pt)ความต่อเนื่องที่ $x = 1$ ให้ $a + b = 1$
#v(2pt)ความต่อเนื่องที่ $x = 2$ ให้ $2 a + b = 8$
#v(2pt)แก้ระบบสมการได้ $a = 7 class("punctuation", ",") b = − 6$ ดังนั้น $a + b + 1 = 2$
#v(2pt)จึงได้ $g lr((a + b + 1)) = g lr((2)) = 2 a + b = 8$ ตอบ ง