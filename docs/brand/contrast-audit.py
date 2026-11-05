#!/usr/bin/env python3
"""Recalculates every colour pair the guidelines approve. Run: python3 contrast-audit.py"""
def L(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    c=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
def R(a,b):
    x,y=sorted([L(a),L(b)],reverse=True);return (x+.05)/(y+.05)
T=4.5;G=3.0
P=[ # label, fg, bg, need
("White on Blue","#FFFFFF","#1F3DFF",T),("White on Blue hover","#FFFFFF","#1A36E6",T),("White on Deep Blue","#FFFFFF","#142AB8",T),
("Blue on White","#1F3DFF","#FFFFFF",T),("Blue on Froth","#1F3DFF","#F8F4F1",T),("Blue on Blue Tint","#1F3DFF","#E8EBFF",T),("Deep Blue on Blue Tint","#142AB8","#E8EBFF",T),
("Deep Blue on White (sidebar active)","#142AB8","#FFFFFF",T),
("Espresso on White","#18100F","#FFFFFF",T),("Espresso on Froth","#18100F","#F8F4F1",T),("Espresso on Oat","#18100F","#EFE9E3",T),
("Taupe on White","#6B5E57","#FFFFFF",T),("Taupe on Froth","#6B5E57","#F8F4F1",T),("Taupe on Oat","#6B5E57","#EFE9E3",T),
("Espresso on Sky","#18100F","#6EC1FF",T),("Espresso on Orange","#18100F","#FF5500",T),("Espresso on Egg Yolk","#18100F","#FFCA48",T),("Espresso on Mint","#18100F","#B8D9C5",T),("White on Plum","#FFFFFF","#5F2B4B",T),
("Success on White","#1F6B47","#FFFFFF",T),("Success on soft","#1F6B47","#E2EFE7",T),("Warning on White","#8A5A00","#FFFFFF",T),("Warning on soft","#8A5A00","#FFF1CC",T),("Error on White","#B42318","#FFFFFF",T),("Error on soft","#B42318","#FEF3F2",T),
("Control border Stone on White (non-text)","#8C7B6E","#FFFFFF",G),("Control border Stone on Froth (non-text)","#8C7B6E","#F8F4F1",G),
("Focus ring Blue on White (non-text)","#1F3DFF","#FFFFFF",G),("Focus ring Blue on Froth (non-text)","#1F3DFF","#F8F4F1",G),("Focus ring White on Deep Blue (non-text)","#FFFFFF","#142AB8",G),
("Dark: Near-white on Near-black","#FAFAFA","#0F0F10",T),("Dark: Near-white on card","#FAFAFA","#18181A",T),("Dark: muted on card","#A1A1AA","#18181A",T),
("Dark: Near-black on brand fill","#0F0F10","#6F86FF",T),("Dark: Near-black on brand hover","#0F0F10","#8C9EFF",T),("Dark: brand text on Near-black","#8C9EFF","#0F0F10",T),("Dark: brand text on card","#8C9EFF","#18181A",T),("Dark: brand fill on card (non-text)","#6F86FF","#18181A",G),("Dark: brand text on brand soft","#8C9EFF","#25252B",T),
("Dark: error on card","#FDA29B","#18181A",T),("Dark: success on card","#9CCFB0","#18181A",T),("Dark: warning on card","#FFCA48","#18181A",T),("Dark: control border on card (non-text)","#747478","#18181A",G),
("Chart 1 Blue on White (non-text)","#1F3DFF","#FFFFFF",G),("Chart 2 Orange on White (non-text)","#FF5500","#FFFFFF",G),("Chart 3 Plum on White (non-text)","#5F2B4B","#FFFFFF",G),("Chart 4 River on White (non-text)","#1C86D1","#FFFFFF",G),("Chart 5 Pine on White (non-text)","#2E8B62","#FFFFFF",G),
("Dark chart 1 on card (non-text)","#8C9EFF","#221816",G),("Dark chart 2 Orange on card (non-text)","#FF5500","#221816",G),("Dark chart 3 on card (non-text)","#E3A9C9","#221816",G),("Dark chart 4 Sky on card (non-text)","#6EC1FF","#221816",G),("Dark chart 5 Mint on card (non-text)","#B8D9C5","#221816",G),
]
F=[("White on Orange","#FFFFFF","#FF5500",T),("Espresso on Blue","#18100F","#1F3DFF",T),("Orange on Blue","#FF5500","#1F3DFF",T),("Egg Yolk on Blue (small text)","#FFCA48","#1F3DFF",T),("Sky on Blue","#6EC1FF","#1F3DFF",T),("Sky on White","#6EC1FF","#FFFFFF",T)]
bad=0
print("APPROVED")
for n,a,b,t in P:
    r=R(a,b);ok=r>=t;bad+=not ok;print(f"{'PASS' if ok else 'FAIL'}  {r:5.2f}:1 (need {t}) {n} {a} on {b}")
print("\nBANNED AS TEXT (must fail; documented in the guide)")
for n,a,b,t in F:
    r=R(a,b);ok=r<t;bad+=not ok;print(f"{'OK  ' if ok else 'WRONG'}  {r:5.2f}:1 {n}")
print("\nproblems:",bad);raise SystemExit(1 if bad else 0)
