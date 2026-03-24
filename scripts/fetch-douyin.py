#!/usr/bin/env python3
"""Fetch Douyin hot search from tophub.today, fallback to empty."""
import json, re, sys, urllib.request
from datetime import datetime, timezone

output = 'data/douyin-trends.json'
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def scrape_tophub():
    """Try tophub.today for real douyin data."""
    req = urllib.request.Request(
        'https://tophub.today/n/X9ozB3edRx',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8')
    
    items = re.findall(r'<a[^>]*target="_blank"[^>]*>([^<]+)</a>', html)
    trends = []
    seen = set()
    for item in items:
        item = item.strip()
        if not item or len(item) < 2 or item in seen:
            continue
        if item.startswith('http') or item in ('tophub.today', '今日热榜'):
            continue
        seen.add(item)
        trends.append({
            'topic_cn': item,
            'topic_en': item,
            'context': ''
        })
    return trends[:15]

def scrape_weibo_hot():
    """Fallback: try weibo hot search via tophub."""
    req = urllib.request.Request(
        'https://tophub.today/n/KqndgxeLl9',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8')
    
    items = re.findall(r'<a[^>]*target="_blank"[^>]*>([^<]+)</a>', html)
    trends = []
    seen = set()
    for item in items:
        item = item.strip()
        if not item or len(item) < 2 or item in seen:
            continue
        if item.startswith('http') or item in ('tophub.today', '今日热榜'):
            continue
        seen.add(item)
        trends.append({
            'topic_cn': item,
            'topic_en': item,
            'context': 'Weibo Hot Search'
        })
    return trends[:15]

trends = []
try:
    trends = scrape_tophub()
    print(f'Douyin: {len(trends)} items from tophub')
except Exception as e:
    print(f'Tophub douyin failed: {e}')
    try:
        trends = scrape_weibo_hot()
        print(f'Weibo fallback: {len(trends)} items')
    except Exception as e2:
        print(f'Weibo fallback also failed: {e2}')

result = {'updated': now, 'trends': trends}
with open(output, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f'Wrote {len(trends)} trends to {output}')
