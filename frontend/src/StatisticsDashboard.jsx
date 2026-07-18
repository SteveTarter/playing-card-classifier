// StatisticsDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Card, ProgressBar, Table, Badge, Spinner, Alert, Button } from "react-bootstrap";
import { AuthHelper } from "./AuthHelper";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.API_BASE_URL || "";

// Reusable SVG circular progress ring
function AccuracyRing({ accuracy, size = 120, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (accuracy / 100) * circumference;

  // Determine color based on accuracy
  let color = "#E53E3E"; // Red
  if (accuracy >= 85) color = "#38A169"; // Green
  else if (accuracy >= 70) color = "#DD6B20"; // Orange

  return (
    <div className="position-relative d-inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div
        className="position-absolute top-50 start-50 translate-middle text-center"
        style={{ width: "100%" }}
      >
        <span className="fs-3 fw-bold text-dark">{accuracy.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function StatisticsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = {};
      const idToken = AuthHelper.getIdToken();
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/grading?action=stats&_=${Date.now()}`, {
        headers
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" role="status" className="mb-2" />
        <div>Loading dashboard analytics...</div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>Error loading statistics</Alert.Heading>
          <p>{error}</p>
          <Button onClick={fetchStats} variant="outline-danger">Try Again</Button>
        </Alert>
      </Container>
    );
  }

  if (!stats || stats.total_judged === 0) {
    return (
      <Container className="py-4">
        <Card className="text-center p-5 shadow-sm border-0 rounded-3">
          <Card.Body>
            <div className="fs-1 mb-3">📊</div>
            <Card.Title className="fw-bold">No data available yet</Card.Title>
            <Card.Text className="text-muted">
              Card grading statistics will populate once you begin judging card predictions.
            </Card.Text>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  // Define styling for suits
  const suitMeta = {
    clubs: { label: "Clubs ♣️", color: "secondary", hex: "#4A5568" },
    diamonds: { label: "Diamonds ♦️", color: "danger", hex: "#E53E3E" },
    hearts: { label: "Hearts ♥️", color: "danger", hex: "#C53030" },
    spades: { label: "Spades ♠️", color: "dark", hex: "#1A202C" },
    joker: { label: "Joker 🃏", color: "info", hex: "#805AD5" }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold m-0">Model Accuracy Dashboard</h2>
        <Button onClick={fetchStats} variant="outline-primary" size="sm">Refresh Data</Button>
      </div>

      <Row className="g-4 mb-4">
        {/* Main accuracy Ring card */}
        <Col md={4}>
          <Card className="shadow-sm border-0 rounded-3 text-center p-3 h-100 d-flex flex-column justify-content-center align-items-center">
            <Card.Body className="d-flex flex-column justify-content-center align-items-center">
              <Card.Title className="text-muted mb-3 fs-6 fw-semibold text-uppercase">Overall Accuracy</Card.Title>
              <AccuracyRing accuracy={stats.overall_accuracy * 100} />
              <div className="mt-3 text-muted">
                <strong>{stats.total_correct}</strong> correct / <strong>{stats.total_judged}</strong> total graded
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Confidence metric card */}
        <Col md={4}>
          <Card className="shadow-sm border-0 rounded-3 p-3 h-100 d-flex flex-column justify-content-center">
            <Card.Body>
              <Card.Title className="text-muted mb-4 fs-6 fw-semibold text-uppercase">Model Confidence Insights</Card.Title>
              <div className="mb-4">
                <div className="d-flex justify-content-between mb-1">
                  <span className="fw-semibold">Avg. Correct Guess Confidence:</span>
                  <span className="text-success fw-bold">{(stats.avg_correct_confidence * 100).toFixed(1)}%</span>
                </div>
                <ProgressBar variant="success" now={stats.avg_correct_confidence * 100} style={{ height: "8px" }} />
              </div>
              <div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="fw-semibold">Avg. Incorrect Guess Confidence:</span>
                  <span className="text-danger fw-bold">{(stats.avg_incorrect_confidence * 100).toFixed(1)}%</span>
                </div>
                <ProgressBar variant="danger" now={stats.avg_incorrect_confidence * 100} style={{ height: "8px" }} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Quick summaries */}
        <Col md={4}>
          <Card className="shadow-sm border-0 rounded-3 p-3 h-100 d-flex flex-column justify-content-center">
            <Card.Body>
              <Card.Title className="text-muted mb-4 fs-6 fw-semibold text-uppercase">System Summary</Card.Title>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span>Valid Reviewed:</span>
                <span className="fw-bold">{stats.total_judged}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span>Correct Guesses:</span>
                <span className="fw-bold text-success">{stats.total_correct}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span>Incorrect Guesses:</span>
                <span className="fw-bold text-danger">{stats.total_judged - stats.total_correct}</span>
              </div>
              <div className="d-flex justify-content-between py-2">
                <span>Invalid Cards (Excluded):</span>
                <span className="fw-bold text-warning">⚠️ {stats.total_invalid || 0}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        {/* Suit breakdowns */}
        <Col md={6}>
          <Card className="shadow-sm border-0 rounded-3 p-4 h-100">
            <h4 className="fw-bold mb-4 fs-5">Accuracy by Suit</h4>
            {stats.accuracy_by_suit.map((s) => {
              const meta = suitMeta[s.suit] || { label: s.suit, hex: "#4A5568" };
              const acc = s.accuracy * 100;
              return (
                <div key={s.suit} className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="fw-semibold text-capitalize">{meta.label}</span>
                    <span className="text-muted">
                      {acc.toFixed(1)}% ({s.correct}/{s.total})
                    </span>
                  </div>
                  <div className="progress" style={{ height: "12px" }}>
                    <div
                      className="progress-bar"
                      role="progressbar"
                      style={{
                        width: `${acc}%`,
                        backgroundColor: meta.hex
                      }}
                      aria-valuenow={acc}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>

        {/* Rank breakdowns */}
        <Col md={6}>
          <Card className="shadow-sm border-0 rounded-3 p-4 h-100">
            <h4 className="fw-bold mb-4 fs-5">Accuracy by Rank</h4>
            <div className="d-flex flex-wrap gap-2 justify-content-start">
              {stats.accuracy_by_rank.map((r) => {
                const acc = r.accuracy * 100;
                let bgClass = "bg-danger";
                if (acc >= 85) bgClass = "bg-success";
                else if (acc >= 70) bgClass = "bg-warning text-dark";

                return (
                  <Card key={r.rank} className="text-center shadow-none border" style={{ width: "75px" }}>
                    <div className="bg-light py-1 fw-bold text-capitalize border-bottom fs-6" style={{ height: "30px", overflow: "hidden" }}>
                      {r.rank.substring(0, 5)}
                    </div>
                    <div className={`py-2 text-white fw-bold ${bgClass}`} style={{ fontSize: "0.85rem" }}>
                      {acc.toFixed(0)}%
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        {/* Misclassification list */}
        <Col md={6}>
          <Card className="shadow-sm border-0 rounded-3 p-4 h-100">
            <h4 className="fw-bold mb-3 fs-5">Top Model Confusions</h4>
            {stats.common_errors.length === 0 ? (
              <p className="text-muted mt-3">No misclassifications recorded! The model has been 100% accurate so far.</p>
            ) : (
              <div className="mt-2">
                {stats.common_errors.map((err, i) => (
                  <div key={i} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                      Predicted <span className="text-danger fw-semibold text-capitalize">{err.predicted}</span>
                      <br />
                      but was actually <span className="text-success fw-semibold text-capitalize">{err.actual}</span>
                    </div>
                    <Badge bg="danger" className="fs-6 py-2 px-3 rounded">
                      {err.count} {err.count === 1 ? "time" : "times"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* Recent Judgments table */}
        <Col md={6}>
          <Card className="shadow-sm border-0 rounded-3 p-4 h-100">
            <h4 className="fw-bold mb-3 fs-5">Recent Judgments Log</h4>
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle mt-2">
                <thead>
                  <tr>
                    <th>Guess</th>
                    <th>Actual</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_judgments.map((item, idx) => (
                    <tr key={idx}>
                      <td className="text-capitalize text-muted">{item.predicted_label}</td>
                      <td className="text-capitalize fw-semibold">{item.actual_label}</td>
                      <td>
                        {item.actual_label === "invalid" ? (
                          <Badge bg="warning" text="dark">Invalid</Badge>
                        ) : item.is_correct ? (
                          <Badge bg="success">Correct</Badge>
                        ) : (
                          <Badge bg="danger">Corrected</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
