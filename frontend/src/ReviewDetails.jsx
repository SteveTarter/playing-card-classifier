import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Row, Col, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { AuthHelper } from './AuthHelper';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://kwps65rcpf.execute-api.us-east-1.amazonaws.com/prod';

export default function ReviewDetails({ filterType, filterValue, onBack }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = {};
      const idToken = AuthHelper.getIdToken();
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }
      
      const res = await fetch(
        `${API_BASE_URL}/stats?action=details&filter_type=${filterType}&filter_value=${filterValue}&_=${Date.now()}`,
        { headers }
      );
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setCards(data.cards || []);
      setCurrentIndex(0);
    } catch (err) {
      setError(err.message || "Failed to load review details.");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterValue]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (cards.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards, currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" className="mb-2" />
        <p className="text-muted">Loading judgments...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>Error Loading Details</Alert.Heading>
          <p>{error}</p>
          <div className="d-flex gap-2">
            <Button onClick={fetchDetails} variant="outline-danger">Try Again</Button>
            <Button onClick={onBack} variant="secondary">Back to Stats</Button>
          </div>
        </Alert>
      </Container>
    );
  }

  if (cards.length === 0) {
    return (
      <Container className="py-4">
        <Card className="text-center p-5 shadow-sm border-0 rounded-3">
          <Card.Body>
            <div className="fs-1 mb-3">🔍</div>
            <Card.Title className="fw-bold">No judgments found</Card.Title>
            <Card.Text className="text-muted">
              No reviewed cards match the filter: <strong className="text-capitalize">{filterValue}</strong>.
            </Card.Text>
            <Button onClick={onBack} variant="primary">Back to Stats</Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  const activeCard = cards[currentIndex];
  const dateStr = activeCard.judged_at
    ? new Date(activeCard.judged_at).toLocaleString()
    : "Unknown Date";

  const displayTitle = filterValue === "invalid" ? "Invalid Cards" : filterValue;

  return (
    <Container className="py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <Button onClick={onBack} variant="outline-secondary" className="d-flex align-items-center gap-2">
          ← Back to Stats
        </Button>
        <h2 className="m-0 fw-bold text-capitalize text-center flex-grow-1">
          Reviewing: {displayTitle}
        </h2>
        <div style={{ width: "130px" }} className="text-end text-muted fw-semibold">
          Card {currentIndex + 1} of {cards.length}
        </div>
      </div>

      <Row className="justify-content-center">
        <Col md={10} lg={8}>
          <Card className="shadow border-0 rounded-3 overflow-hidden">
            <Row className="g-0">
              {/* Image side */}
              <Col md={6} className="bg-light d-flex align-items-center justify-content-center p-4 border-end">
                {activeCard.image_url ? (
                  <img
                    src={activeCard.image_url}
                    alt="Judged playing card"
                    className="img-fluid rounded shadow-sm bg-white"
                    style={{ maxHeight: "380px", objectFit: "contain" }}
                  />
                ) : (
                  <div className="text-muted text-center py-5">
                    <div className="fs-2 mb-2">📷</div>
                    No image available
                  </div>
                )}
              </Col>

              {/* Data side */}
              <Col md={6} className="d-flex flex-column justify-content-between p-4">
                <div>
                  <h4 className="fw-bold text-secondary mb-4 border-bottom pb-2">Judgment Details</h4>
                  
                  <div className="mb-3">
                    <span className="text-muted d-block small">DATE SUBMITTED</span>
                    <strong className="fs-6">{dateStr}</strong>
                  </div>

                  <div className="mb-3">
                    <span className="text-muted d-block small">MODEL PREDICTION</span>
                    <strong className="fs-5 text-primary text-capitalize">{activeCard.predicted_label}</strong>
                    <div className="mt-1">
                      <Badge bg={Number(activeCard.confidence) > 0.8 ? "success" : "warning"} className="py-1 px-2">
                        Confidence: {(Number(activeCard.confidence) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-muted d-block small">JUDGMENT STATUS</span>
                    {activeCard.is_correct ? (
                      <div>
                        <Badge bg="success" className="py-2 px-3 fs-6 rounded-pill mt-1">
                          ✓ Correct Prediction
                        </Badge>
                        <p className="text-muted small mt-2">The model guessed the card rank and suit correctly.</p>
                      </div>
                    ) : (
                      <div>
                        <Badge bg="danger" className="py-2 px-3 fs-6 rounded-pill mt-1">
                          ✗ Incorrect (Corrected)
                        </Badge>
                        <div className="mt-2 p-2 bg-danger-subtle text-danger border border-danger-subtle rounded-2">
                          <span className="small d-block text-muted">CORRECT LABEL:</span>
                          <strong className="text-capitalize fs-6">{activeCard.actual_label}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card navigation buttons */}
                {cards.length > 1 && (
                  <div className="d-flex gap-3 border-top pt-3 mt-4">
                    <Button onClick={handlePrev} variant="outline-primary" className="w-50 fw-semibold">
                      ◀ Previous
                    </Button>
                    <Button onClick={handleNext} variant="primary" className="w-50 fw-semibold">
                      Next ▶
                    </Button>
                  </div>
                )}
              </Col>
            </Row>
          </Card>
          {cards.length > 1 && (
            <p className="text-center text-muted small mt-3">
              Tip: Use the <strong>Left</strong> and <strong>Right</strong> arrow keys on your keyboard to page through the cards.
            </p>
          )}
        </Col>
      </Row>
    </Container>
  );
}
