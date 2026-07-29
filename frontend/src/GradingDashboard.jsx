// GradingDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Card, Button, Form, Alert, Spinner, Badge } from "react-bootstrap";
import { AuthHelper } from "./AuthHelper";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.API_BASE_URL || "";

const CARD_LABELS = [
  'ace of clubs', 'ace of diamonds', 'ace of hearts', 'ace of spades',
  'eight of clubs', 'eight of diamonds', 'eight of hearts', 'eight of spades',
  'five of clubs', 'five of diamonds', 'five of hearts', 'five of spades',
  'four of clubs', 'four of diamonds', 'four of hearts', 'four of spades',
  'jack of clubs', 'jack of diamonds', 'jack of hearts', 'jack of spades',
  'joker',
  'king of clubs', 'king of diamonds', 'king of hearts', 'king of spades',
  'nine of clubs', 'nine of diamonds', 'nine of hearts', 'nine of spades',
  'queen of clubs', 'queen of diamonds', 'queen of hearts', 'queen of spades',
  'seven of clubs', 'seven of diamonds', 'seven of hearts', 'seven of spades',
  'six of clubs', 'six of diamonds', 'six of hearts', 'six of spades',
  'ten of clubs', 'ten of diamonds', 'ten of hearts', 'ten of spades',
  'three of clubs', 'three of diamonds', 'three of hearts', 'three of spades',
  'two of clubs', 'two of diamonds', 'two of hearts', 'two of spades'
];

// Custom sorting logic: 2 3 4 5 6 7 8 9 10 Jack Queen King Ace
const rankOrder = {
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'jack': 11,
  'queen': 12,
  'king': 13,
  'ace': 14,
  'joker': 15
};

const getRankOfLabel = (label) => {
  if (label.includes(" of ")) {
    return label.split(" of ")[0];
  }
  return label;
};

const customSortLabels = (labels) => {
  return [...labels].sort((a, b) => {
    const rankA = getRankOfLabel(a);
    const rankB = getRankOfLabel(b);
    return (rankOrder[rankA] || 0) - (rankOrder[rankB] || 0);
  });
};

// Group cards by suit for select element
const suitGroups = {
  "Clubs ♣️": customSortLabels(CARD_LABELS.filter(l => l.endsWith("clubs"))),
  "Diamonds ♦️": customSortLabels(CARD_LABELS.filter(l => l.endsWith("diamonds"))),
  "Hearts ♥️": customSortLabels(CARD_LABELS.filter(l => l.endsWith("hearts"))),
  "Spades ♠️": customSortLabels(CARD_LABELS.filter(l => l.endsWith("spades"))),
  "Other": customSortLabels(CARD_LABELS.filter(l => !l.includes(" of ")))
};


export default function GradingDashboard() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCorrectionSelect, setShowCorrectionSelect] = useState(false);
  const [correctedLabel, setCorrectedLabel] = useState(CARD_LABELS[0]);
  const [imageLoading, setImageLoading] = useState(true);

  const activeImageUrl = cards[0]?.image_url;

  useEffect(() => {
    if (activeImageUrl) {
      setImageLoading(true);
    }
  }, [activeImageUrl]);


  const fetchUnjudged = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idToken = AuthHelper.getIdToken();
      const res = await fetch(`${API_BASE_URL}/grading?action=list&_=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setCards(data.unjudged_cards || []);
      if (data.unjudged_cards && data.unjudged_cards.length > 0) {
        // Default corrected label to the first item's prediction in case they correct it
        setCorrectedLabel(data.unjudged_cards[0].predicted_label);
      }
    } catch (err) {
      setError(err.message || "Failed to load unjudged queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnjudged();
  }, [fetchUnjudged]);

  const submitGrade = async (requestId, actualLabel) => {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const idToken = AuthHelper.getIdToken();
      const res = await fetch(`${API_BASE_URL}/grading`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          request_id: requestId,
          actual_label: actualLabel
        })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      
      if (actualLabel === "invalid") {
        setMessage("Card marked as invalid/unclear.");
      } else {
        setMessage(data.is_correct ? "Approved! Guess was correct." : `Correction saved: was actually ${actualLabel}.`);
      }
      
      // Remove this card from the queue locally
      setCards(prev => {
        const nextCards = prev.slice(1);
        if (nextCards.length > 0) {
          setCorrectedLabel(nextCards[0].predicted_label);
        }
        return nextCards;
      });
      setShowCorrectionSelect(false);
    } catch (err) {
      setError(err.message || "Failed to submit grading.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" role="status" className="mb-2" />
        <div>Loading unjudged cards queue...</div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>Error loading queue</Alert.Heading>
          <p>{error}</p>
          <Button onClick={fetchUnjudged} variant="outline-danger">Try Again</Button>
        </Alert>
      </Container>
    );
  }

  if (cards.length === 0) {
    return (
      <Container className="py-4">
        <Card className="text-center p-5 shadow-sm border-0 rounded-3">
          <Card.Body>
            <div className="fs-1 mb-3">🎉</div>
            <Card.Title className="fw-bold">All caught up!</Card.Title>
            <Card.Text className="text-muted">
              All playing card image uploads have been reviewed and judged.
              Try classifying new cards on the home page to populate the queue.
            </Card.Text>
            <Button onClick={fetchUnjudged} variant="primary">Refresh Queue</Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  const activeCard = cards[0];

  return (
    <Container className="py-4">
      <h2 className="text-center mb-4 fw-bold">Admin Grading Queue</h2>
      
      {message && <Alert variant="success" onClose={() => setMessage("")} dismissible>{message}</Alert>}

      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow border-0 rounded-3 overflow-hidden">
            <div className="bg-light text-center py-4 border-bottom position-relative" style={{ minHeight: "340px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Badge bg="secondary" className="position-absolute top-0 start-0 m-3 fs-6" style={{ zIndex: 1 }}>
                Queue: {cards.length} remaining
              </Badge>
              {imageLoading && (
                <div className="position-absolute top-50 start-50 translate-middle">
                  <Spinner animation="border" variant="primary" role="status" />
                </div>
              )}
              <img
                src={activeCard.image_url}
                alt="Card upload"
                className="img-fluid border rounded shadow-sm bg-white"
                style={{ maxHeight: 300, objectFit: "contain", display: imageLoading ? "none" : "inline-block" }}
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
            </div>
            
            <Card.Body className="p-4">
              <div className="mb-4 text-center">
                <h5 className="text-muted mb-1 fs-6">Model Prediction</h5>
                <h3 className="fw-bold text-primary text-capitalize mb-2">
                  {activeCard.predicted_label}
                </h3>
                <div>
                  <Badge bg={Number(activeCard.confidence) > 0.8 ? "success" : "warning"} className="fs-6 py-2 px-3 rounded-pill">
                    Confidence: {(Number(activeCard.confidence) * 100).toFixed(2)}%
                  </Badge>
                </div>
                <small className="text-muted d-block mt-3">
                  Uploaded at: {new Date(activeCard.timestamp).toLocaleString()}
                </small>
              </div>

              {!showCorrectionSelect ? (
                <div>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Button
                        onClick={() => submitGrade(activeCard.request_id, activeCard.predicted_label)}
                        variant="success"
                        className="w-100 py-3 fw-bold rounded-2"
                        disabled={submitting || imageLoading}
                      >
                        {submitting ? "Saving..." : "✓ Correct (Approve)"}
                      </Button>
                    </Col>
                    <Col xs={6}>
                      <Button
                        onClick={() => setShowCorrectionSelect(true)}
                        variant="danger"
                        className="w-100 py-3 fw-bold rounded-2"
                        disabled={submitting || imageLoading}
                      >
                        ✗ Wrong (Correct)
                      </Button>
                    </Col>
                  </Row>
                  <Row className="g-2 mt-2">
                    <Col xs={12}>
                      <Button
                        onClick={() => submitGrade(activeCard.request_id, "invalid")}
                        variant="outline-secondary"
                        className="w-100 py-2 fw-semibold rounded-2"
                        disabled={submitting || imageLoading}
                      >
                        ⚠️ Invalid Card (Not a Card / Bad Image)
                      </Button>
                    </Col>
                  </Row>
                </div>
              ) : (
                <div className="bg-light p-3 border rounded-3 mb-3">
                  <Form.Group className="mb-3" controlId="correctionSelect">
                    <Form.Label className="fw-semibold">Select Correct Card Label:</Form.Label>
                    <Form.Select
                      value={correctedLabel}
                      onChange={(e) => setCorrectedLabel(e.target.value)}
                      className="text-capitalize"
                      disabled={submitting || imageLoading}
                    >
                      {Object.entries(suitGroups).map(([groupName, labels]) => (
                        <optgroup label={groupName} key={groupName}>
                          {labels.map(lbl => (
                            <option value={lbl} key={lbl} className="text-capitalize">
                              {lbl}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <div className="d-flex gap-2">
                    <Button
                      onClick={() => submitGrade(activeCard.request_id, correctedLabel)}
                      variant="primary"
                      className="flex-grow-1 fw-semibold"
                      disabled={submitting || imageLoading}
                    >
                      Submit Correction
                    </Button>
                    <Button
                      onClick={() => setShowCorrectionSelect(false)}
                      variant="outline-secondary"
                      disabled={submitting || imageLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
