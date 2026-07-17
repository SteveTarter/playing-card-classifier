import React from "react";
import { Container, Card } from "react-bootstrap";

export default function InfoPanel({ activeSection }) {
  if (!activeSection) return null;

  const SectionWrapper = ({ title, children }) => (
    <Container className="py-4">
      <Card className="mb-4">
        <Card.Body>
          <h4>{title}</h4>
          <div>{children}</div>
        </Card.Body>
      </Card>
    </Container>
  );

  if (activeSection === "directions") {
    return (
      <SectionWrapper title="Directions">
        <ol>
          <li>Take or upload a photo of a playing card.</li>
          <li>Submit it using the form.</li>
          <li>
            In seconds, receive a classification result—learn whether the model
            guessed correctly or needs more training.
          </li>
        </ol>
      </SectionWrapper>
    );
  }

  if (activeSection === "about") {
    return (
      <SectionWrapper title="About">
        This app is the web client interface for the Tarterware Playing‑Card Classifier,
        powered by TensorFlow and crafted after the TensorFlow Developer Certificate –
        Image Classification course. It enables users to upload a card image and get an
        instant prediction of its value and suit—leveraging a custom convolutional neural
        network. The network trained on a dataset of&nbsp;
        <a href="https://www.kaggle.com/datasets/gpiosenka/cards-image-datasetclassification">
          playing‑card images from Kaggle
        </a>. The application frontend and backend are hosted
        on Amazon Web Services. GitHub hosts both the&nbsp;
        <a href="https://github.com/SteveTarter/playing-card-classifier">backend</a>&nbsp;and
        &nbsp;<a href="https://github.com/SteveTarter/playing-card-classifier-frontend">frontend</a>.
        <hr />
        <h4>Why This App Was Built</h4>
        <ul>
          <li>
            <b>Educational:</b> Demonstrates core ML concepts—image preprocessing, CNN modeling,
            and real‑time prediction. Demonstrates deployment of the entire system on AWS.
          </li>
          <li>
            <b>Interactive:</b> Users can upload photos of cards and see immediate results—
            providing hands‑on ML experience.
          </li>
          <li>
            <b>Extendable:</b> Future improvements include testing with more edge‑case images
            and expanding the dataset using AI‑generated samples.
          </li>
        </ul>
      </SectionWrapper>
    );
  }

  if (activeSection === "legal") {
    return (
      <SectionWrapper title="Legal">
        <b>Image Usage for Model Improvement</b><br />
        When you submit an image of a playing card through this application, that
        image—along with the classifier's predicted result—may be retained and used for
        the purposes of evaluating and improving the underlying machine learning model.
        This includes using submitted data for model retraining, performance analysis, and
        debugging misclassifications. These images will not be used for commercial purposes
        or shared outside the context of model development.<br /><br />

        <b>No Warranty or Guarantee</b><br />
        This application is provided “as is” for educational and demonstration purposes.
        While we strive for accuracy, no guarantee is made regarding the correctness of
        predictions or the uninterrupted availability of the service. Users should not rely
        on this tool for any critical or production use.<br /><br />

        <b>Limitation of Liability</b><br />
        Under no circumstances shall the developer be liable for any direct, indirect,
        incidental, or consequential damages resulting from the use or inability to use
        the application.<br /><br />

        <b>Third-Party Services</b><br />
        This application may interact with third-party services or APIs (e.g., AWS). These
        services operate under their own terms of service and privacy policies. We encourage
        users to review those separately.<br /><br />

        <b>Privacy and Security</b><br />
        We do not collect personally identifiable information. However, all data
        transmissions are subject to standard internet security risks. Users should
        avoid submitting sensitive or personal data through the platform.<br /><br />

        <b>Contact</b><br />
        For questions or concerns about this legal policy, please contact&nbsp;
        <a href="mailto:steve@tarterware.com">steve@tarterware.com</a>.
      </SectionWrapper>
    );
  }

  return null;
}
