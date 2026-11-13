from __future__ import annotations

KICKERS: dict[str, list[str]] = {
    "en": ["Context", "The problem", "Evidence", "Why it matters", "The turn", "What now"],
    "bn": ["প্রেক্ষাপট", "সমস্যা", "প্রমাণ", "কেন জরুরি", "মোড়", "এখন কী"],
    "hi": ["संदर्भ", "समस्या", "सबूत", "क्यों ज़रूरी", "मोड़", "अब क्या"],
    "ar": ["السياق", "المشكلة", "الدليل", "لماذا يهم", "التحول", "ماذا الآن"],
    "ur": ["پس منظر", "مسئلہ", "ثبوت", "کیوں اہم", "موڑ", "اب کیا"],
    "ja": ["背景", "問題", "根拠", "なぜ重要か", "転機", "これから"],
    "zh-Hans": ["背景", "问题", "证据", "为何重要", "转折", "接下来"],
    "zh-Hant": ["背景", "問題", "證據", "為何重要", "轉折", "接下來"],
    "ko": ["배경", "문제", "근거", "왜 중요한가", "전환", "이제는"],
    "th": ["บริบท", "ปัญหา", "หลักฐาน", "ทำไมสำคัญ", "จุดเปลี่ยน", "ต่อจากนี้"],
    "es": ["Contexto", "El problema", "Evidencia", "Por qué importa", "El giro", "Y ahora"],
    "fr": ["Contexte", "Le problème", "Les preuves", "Pourquoi c'est important", "Le tournant", "Et maintenant"],
    "de": ["Kontext", "Das Problem", "Belege", "Warum es wichtig ist", "Die Wende", "Was jetzt"],
    "pt": ["Contexto", "O problema", "Evidências", "Por que importa", "A virada", "E agora"],
    "ru": ["Контекст", "Проблема", "Факты", "Почему это важно", "Поворот", "Что дальше"],
    "id": ["Konteks", "Masalahnya", "Bukti", "Mengapa penting", "Titik balik", "Sekarang apa"],
    "tr": ["Bağlam", "Sorun", "Kanıt", "Neden önemli", "Dönüm noktası", "Şimdi ne"],
}

FOLLOW: dict[str, str] = {
    "en": "Follow for more", "bn": "আরও দেখতে ফলো করুন", "hi": "और देखने के लिए फ़ॉलो करें", "ar": "تابعنا للمزيد", "ur": "مزید کے لیے فالو کریں",
    "ja": "フォローしてね", "zh-Hans": "关注看更多", "zh-Hant": "關注看更多", "ko": "팔로우하고 더 보기", "th": "กดติดตามเพื่อดูเพิ่ม",
    "es": "Síguenos para más", "fr": "Abonne-toi pour la suite", "de": "Folge für mehr", "pt": "Siga para mais", "ru": "Подписывайтесь",
    "id": "Ikuti untuk lebih banyak", "tr": "Daha fazlası için takip et",
}


def kicker(lang: str, index: int, total: int) -> str:
    if index == 0:
        return ""
    labels = KICKERS.get(lang) or ([] if lang != "en" else KICKERS["en"])
    if not labels:
        return ""
    pos = index / max(1, total - 1)
    return labels[min(len(labels) - 1, int(pos * len(labels)))]


def follow(lang: str) -> str:
    return FOLLOW.get(lang, "")
