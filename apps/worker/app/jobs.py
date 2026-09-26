def process_material(material_id: str) -> None:
    """Extension point for extraction, chunking, embeddings, and generation."""
    print(f"Processing material {material_id}")
