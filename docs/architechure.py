from graphviz import Digraph

dot = Digraph("CardClassifier", format="svg")

# make it left-to-right, orthogonal edges, bigger font, and add more spacing
dot.attr(
    rankdir="LR",
    splines="ortho",
    fontsize="12",
    ranksep="1.8",   # increase vertical spacing between ranks
    nodesep="1.2",   # increase horizontal spacing between nodes
    size="8,10!",    # exactly 8×10 inches (the “!” locks the aspect)
    ratio="fill"     # scale to completely fill the box)
)

# Browser / UI
dot.node(
    "Browser", "Browser\n(React App)", 
    shape="component", 
    style="rounded,filled", 
    fillcolor="#e0f7fa"
)
dot.node(
    "S3_UI", "S3 Static Website\n(React App)", 
    shape="folder"
)
dot.edge(
    "S3_UI", "Browser", 
    taillabel="loads UI", 
    labeldistance="40.0",   # how far from the node
    labelangle="5",
    fontsize="14",
    fontcolor="black"
)

# Inputs
dot.node(
    "File", "Image File", 
    shape="cylinder"
)
dot.node(
    "Camera", "Camera", 
    shape="note"
)
dot.edge(
    "File", "Browser", 
    taillabel="select image",
    labelfloat="true",
    labeldistance="6.0",
    labelangle="-15",
    fontsize="14",
    fontcolor="black"
)
dot.edge(
    "Camera", "Browser",
    taillabel="capture image",
    labeldistance="35.0",
    labelangle="45",
    fontsize="14",
    fontcolor="black"
)

# API & Compute
dot.node(
    "API", "API Gateway\n(HTTP API)", 
    shape="rectangle", 
    style="rounded,filled", 
    fillcolor="#ffecb3"
)
dot.node(
    "Lambda", "AWS Lambda\n(Image Processor)", 
    shape="rectangle", 
    style="rounded,filled", 
    fillcolor="#ffe0b2"
)
dot.edge(
    "Browser", "API", 
    headlabel="POST image",
    labeldistance="20.0",
    labelangle="50",
    fontsize="14",
    fontcolor="black"
)
dot.edge(
    "API", "Lambda", 
    taillabel="invoke",
    labeldistance="20.0",
    labelangle="10",
    fontsize="14",
    fontcolor="black"
)

# Inference & Storage
dot.node(
    "SM", "SageMaker\nEndpoint", 
    shape="rectangle", 
    style="rounded,filled", 
    fillcolor="#d1c4e9"
)
dot.node(
    "ModelBucket", "S3 Bucket\n(ML Model)", 
    shape="cylinder"
)
dot.edge(
    "Lambda", "SM", 
    taillabel="invoke endpoint",
    labeldistance="7.0",
    labelangle="-15",
    fontsize="14",
    fontcolor="black"
)
dot.edge(
    "SM", "ModelBucket", 
    taillabel="model stored",
    labeldistance="6.0",
    labelangle="15",
    fontsize="14",
    fontcolor="black"
)

# Results
dot.node(
    "ResultsBucket", "S3 Bucket\n(Results)",
    shape="cylinder"
)
dot.edge(
    "SM", "Lambda",
    taillabel="predictions vector",
    labeldistance="6.0",
    labelangle="-15",
    fontsize="14",
    fontcolor="black"
) 
dot.edge(
    "Lambda", "ResultsBucket", 
    taillabel="store PNG + JSON",
    labeldistance="40.0",
    labelangle="10",
    fontsize="14",
    fontcolor="black"
)

# Response back to UI
dot.edge(
    "Lambda", "Browser", 
    taillabel="return label + confidence (JSON)",
    labeldistance="18.0",
    labelangle="10",
    fontsize="14",
    fontcolor="black"
)

# Render!
dot.render("architecture", cleanup=True)
print("Wrote architecture.svg")

