from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
import numpy as np


MODEL_NAME = "ProsusAI/finbert"


class SentimentAnalyzer:
    _instance = None

    def __new__(cls):
        # Singleton — модель вантажиться один раз
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def _load(self):
        if self._loaded:
            return
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
        self.model.eval()
        self.labels = ["positive", "negative", "neutral"]
        self._loaded = True

    def analyze(self, texts: list[str]) -> list[dict]:
        self._load()
        results = []
        for text in texts:
            inputs = self.tokenizer(
                text[:512],
                return_tensors="pt",
                truncation=True,
                padding=True,
            )
            with torch.no_grad():
                logits = self.model(**inputs).logits
            probs = torch.softmax(logits, dim=-1).numpy()[0]
            label_idx = int(np.argmax(probs))
            results.append({
                "text": text[:100] + "..." if len(text) > 100 else text,
                "sentiment": self.labels[label_idx],
                "confidence": round(float(probs[label_idx]), 3),
                "scores": {
                    "positive": round(float(probs[0]), 3),
                    "negative": round(float(probs[1]), 3),
                    "neutral": round(float(probs[2]), 3),
                },
            })
        return results

    def aggregate(self, analyses: list[dict]) -> dict:
        """Зводить список аналізів в один підсумковий сигнал."""
        if not analyses:
            return {"signal": "neutral", "score": 0.0, "count": 0}

        scores = []
        for a in analyses:
            s = a["scores"]
            scores.append(s["positive"] - s["negative"])

        avg = float(np.mean(scores))
        signal = "positive" if avg > 0.1 else "negative" if avg < -0.1 else "neutral"

        return {
            "signal": signal,
            "score": round(avg, 3),
            "count": len(analyses),
            "breakdown": {
                "positive": sum(1 for a in analyses if a["sentiment"] == "positive"),
                "negative": sum(1 for a in analyses if a["sentiment"] == "negative"),
                "neutral": sum(1 for a in analyses if a["sentiment"] == "neutral"),
            },
        }
