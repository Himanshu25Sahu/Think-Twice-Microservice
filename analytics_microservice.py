from flask import Flask, request, jsonify
import pandas as pd
import numpy as np

app = Flask(__name__)

@app.route('/analytics', methods=['GET'])
def analytics():
    user_id = request.args.get('userId')
    range_val = request.args.get('range', 'month')
    # Example: Load data (replace with real DB or API call)
    data = pd.DataFrame({
        'decision_id': [1,2,3],
        'confidence': [0.8, 0.6, 0.9],
        'outcome': [1, 0, 1],
        'timestamp': pd.to_datetime(['2026-03-01', '2026-03-10', '2026-03-15'])
    })
    # Filter by range (example)
    if range_val == 'month':
        data = data[data['timestamp'] > pd.Timestamp('2026-03-01')]
    # Calculate stats
    avg_confidence = data['confidence'].mean()
    success_rate = data['outcome'].mean()
    # Example prediction
    prediction = np.mean(data['confidence'] * data['outcome'])
    return jsonify({
        'avg_confidence': avg_confidence,
        'success_rate': success_rate,
        'prediction': prediction
    })

if __name__ == '__main__':
    app.run(port=5000)
